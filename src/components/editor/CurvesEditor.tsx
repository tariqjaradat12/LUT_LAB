/**
 * CurvesEditor — Interactive Bezier tone curve editor.
 * Renders a grid with draggable control points using PanResponder.
 * Supports RGB master + individual R/G/B channel switching.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, PanResponder,
  GestureResponderEvent, LayoutChangeEvent,
} from 'react-native';
import { CurvePoint, CurveChannels } from '../../core/engine/EditingEngine';
import { CurvesEngine } from '../../core/engine/CurvesEngine';
import { gradingBus } from '../../core/engine/GradingBus';

type Channel = 'rgb' | 'r' | 'g' | 'b';

const CHANNEL_COLORS: Record<Channel, string> = {
  rgb: '#F8FAFC',
  r: '#F87171',
  g: '#4ADE80',
  b: '#60A5FA',
};

interface CurvesEditorProps {
  curves: CurveChannels;
  onChange: (curves: CurveChannels) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

interface IdentifiablePoint extends CurvePoint {
  id: string;
}

interface IdentifiableCurveChannels {
  rgb: IdentifiablePoint[];
  r: IdentifiablePoint[];
  g: IdentifiablePoint[];
  b: IdentifiablePoint[];
}

const GRID = 4;

const areCurvesEqual = (a: CurveChannels, b: CurveChannels): boolean => {
  const channels: Channel[] = ['rgb', 'r', 'g', 'b'];
  for (const ch of channels) {
    if (a[ch].length !== b[ch].length) return false;
    for (let i = 0; i < a[ch].length; i++) {
      if (a[ch][i].x !== b[ch][i].x || a[ch][i].y !== b[ch][i].y) return false;
    }
  }
  return true;
};

const makeIdentifiable = (ch: CurveChannels): IdentifiableCurveChannels => {
  return {
    rgb: ch.rgb.map((pt, i) => ({ ...pt, id: (pt as any).id || `rgb_${i}_${pt.x}_${pt.y}` })),
    r: ch.r.map((pt, i) => ({ ...pt, id: (pt as any).id || `r_${i}_${pt.x}_${pt.y}` })),
    g: ch.g.map((pt, i) => ({ ...pt, id: (pt as any).id || `g_${i}_${pt.x}_${pt.y}` })),
    b: ch.b.map((pt, i) => ({ ...pt, id: (pt as any).id || `b_${i}_${pt.x}_${pt.y}` })),
  };
};

export const CurvesEditor: React.FC<CurvesEditorProps> = ({ curves, onChange, onDragStart, onDragEnd }) => {
  const [activeChannel, setActiveChannel] = useState<Channel>('rgb');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 240, h: 240 });

  const [localCurves, setLocalCurves] = useState<IdentifiableCurveChannels>(() => makeIdentifiable(curves));
  const curvesRef = useRef(curves);

  // Refs to avoid stale closures in PanResponder
  const pointsRef = useRef<IdentifiablePoint[]>(localCurves[activeChannel]);
  const draggingIdRef = useRef<string | null>(null);
  const initialPtRef = useRef({ x: 0, y: 0 });
  const longPressTimerRef = useRef<any>(null);
  const isLongPressedRef = useRef(false);

  const initialCurvesBeforeDragRef = useRef<CurveChannels>(curves);
  const justFinishedDraggingRef = useRef(false);
  const startTouchRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Ref stabilizers for props and state accessed in stable callbacks/PanResponder
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  const onChangeRef = useRef(onChange);
  const canvasSizeRef = useRef(canvasSize);
  const activeChannelRef = useRef(activeChannel);
  const localCurvesRef = useRef(localCurves);

  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragEndRef.current = onDragEnd;
    onChangeRef.current = onChange;
  }, [onDragStart, onDragEnd, onChange]);

  useEffect(() => {
    canvasSizeRef.current = canvasSize;
  }, [canvasSize]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    localCurvesRef.current = localCurves;
  }, [activeChannel, localCurves]);

  useEffect(() => {
    if (draggingIdRef.current !== null) return;
    
    // Check if incoming curves match our local reference
    if (areCurvesEqual(curves, curvesRef.current)) {
      justFinishedDraggingRef.current = false;
      return;
    }

    // Ignore updates that revert back to pre-drag state right after dragging ends (transient parent render protection)
    if (justFinishedDraggingRef.current && areCurvesEqual(curves, initialCurvesBeforeDragRef.current)) {
      return;
    }

    const identifiable = makeIdentifiable(curves);
    setLocalCurves(identifiable);
    curvesRef.current = curves;
    justFinishedDraggingRef.current = false;
  }, [curves]);

  const points = localCurves[activeChannel];
  const accentColor = CHANNEL_COLORS[activeChannel];

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  const setDraggingPointId = (id: string | null) => {
    setDraggingId(id);
    draggingIdRef.current = id;
  };

  const updateBus = (updatedCurves: CurveChannels) => {
    const luts = CurvesEngine.buildAllLUTs(updatedCurves);
    const merged = new Float32Array(1024);
    for (let i = 0; i < 256; i++) {
      merged[4 * i] = luts.rgb[i];
      merged[4 * i + 1] = luts.r[i];
      merged[4 * i + 2] = luts.g[i];
      merged[4 * i + 3] = luts.b[i];
    }
    gradingBus.set('curvesLut', Array.from(merged));
  };

  const updatePoints = useCallback((newPts: IdentifiablePoint[], notifyParent: boolean = false) => {
    const sorted = [...newPts].sort((a, b) => a.x - b.x);
    sorted[0] = { ...sorted[0], x: 0 };
    sorted[sorted.length - 1] = { ...sorted[sorted.length - 1], x: 1 };
    
    const nextLocalCurves = { ...localCurvesRef.current, [activeChannelRef.current]: sorted };
    
    // Update refs synchronously BEFORE setState so the next gesture event
    // (which can fire before the re-render) always reads fresh values.
    localCurvesRef.current = nextLocalCurves;
    pointsRef.current = sorted;
    
    setLocalCurves(nextLocalCurves);

    // Strip IDs for parent/bus
    const cleanCurves = {
      rgb: nextLocalCurves.rgb.map(({ x, y }) => ({ x, y })),
      r: nextLocalCurves.r.map(({ x, y }) => ({ x, y })),
      g: nextLocalCurves.g.map(({ x, y }) => ({ x, y })),
      b: nextLocalCurves.b.map(({ x, y }) => ({ x, y })),
    };
    curvesRef.current = cleanCurves;
    updateBus(cleanCurves);

    // Only notify parent when not in the middle of dragging to avoid
    // expensive parent re-renders on every touch move event.
    if (notifyParent && onChangeRef.current) {
      onChangeRef.current(cleanCurves);
    }
  }, []);

  const findClosestPoint = useCallback((px: number, py: number): number => {
    const { w, h } = canvasSizeRef.current;
    let best = -1;
    let bestDist = 40; // Increased touch hit area to 40dp for extremely forgiving Lightroom-style grabs
    pointsRef.current.forEach((pt, i) => {
      const sx = pt.x * w;
      const sy = (1 - pt.y) * h;
      const dist = Math.sqrt((px - sx) ** 2 + (py - sy) ** 2);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    return best;
  }, []);

  const handleRemovePoint = useCallback((id: string) => {
    const currentPts = pointsRef.current;
    if (currentPts.length <= 2) return;
    if (id === currentPts[0].id || id === currentPts[currentPts.length - 1].id) return;
    if (onDragStartRef.current) onDragStartRef.current();
    const newPts = currentPts.filter(pt => pt.id !== id);
    updatePoints(newPts, true); // Notify parent immediately — discrete action
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => {
      const { locationX, locationY } = e.nativeEvent;
      const closest = findClosestPoint(locationX, locationY);
      return closest !== -1;
    },
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (e, gestureState) => {
      return draggingIdRef.current !== null && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
    },
    onMoveShouldSetPanResponderCapture: (e, gestureState) => {
      return draggingIdRef.current !== null && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2);
    },
    onPanResponderTerminationRequest: () => draggingIdRef.current === null,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const closest = findClosestPoint(locationX, locationY);
      const currentPts = pointsRef.current;

      isLongPressedRef.current = false;
      initialCurvesBeforeDragRef.current = curvesRef.current;
      justFinishedDraggingRef.current = false;

      if (closest !== -1) {
        if (onDragStartRef.current) onDragStartRef.current();
        const targetPt = currentPts[closest];
        setDraggingPointId(targetPt.id);
        initialPtRef.current = { x: targetPt.x, y: targetPt.y };

        // Setup manual long press timer to delete the point (only for middle points)
        const isEndpointPt = targetPt.id === currentPts[0].id || targetPt.id === currentPts[currentPts.length - 1].id;
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (!isEndpointPt) {
          longPressTimerRef.current = setTimeout(() => {
            isLongPressedRef.current = true;
            handleRemovePoint(targetPt.id);
            setDraggingPointId(null); // Cancel current drag
          }, 1500); // 1.5s duration to prevent accidental trigger
        }
      } else {
        setDraggingPointId(null);
        initialPtRef.current = { x: locationX, y: locationY };
      }
    },
    onPanResponderMove: (e: GestureResponderEvent, gestureState) => {
      if (isLongPressedRef.current) return;

      // Cancel long press as soon as the finger moves
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const dragId = draggingIdRef.current;
      if (dragId === null) return;
      
      const currentPts = pointsRef.current;
      const idx = currentPts.findIndex(pt => pt.id === dragId);
      if (idx === -1) return;

      const { w, h } = canvasSizeRef.current;
      const isEndpoint = dragId === currentPts[0].id || dragId === currentPts[currentPts.length - 1].id;

      const deltaX = gestureState.dx / w;
      const deltaY = -gestureState.dy / h;

      const newPts = currentPts.map((pt) => {
        if (pt.id !== dragId) return pt;
        
        let targetX = initialPtRef.current.x + deltaX;
        if (!isEndpoint) {
          // Bounded strictly inside the canvas (0.01 to 0.99)
          targetX = Math.min(0.99, Math.max(0.01, targetX));
        } else {
          targetX = pt.x; // Endpoints cannot move horizontally
        }

        return {
          ...pt,
          x: targetX,
          y: Math.min(1, Math.max(0, initialPtRef.current.y + deltaY)),
        };
      });
      updatePoints(newPts, false); // Don't notify parent during drag — avoids cascading re-renders
    },
    onPanResponderRelease: (e: GestureResponderEvent, gestureState) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      const dragId = draggingIdRef.current;
      if (dragId !== null) {
        justFinishedDraggingRef.current = true;
        setDraggingPointId(null);
        if (onDragEndRef.current) onDragEndRef.current();
        // Notify parent once at release — syncs final curve position
        if (onChangeRef.current) onChangeRef.current(curvesRef.current);
      }
    },
    onPanResponderTerminate: () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      justFinishedDraggingRef.current = true;
      setDraggingPointId(null);
      if (onDragEndRef.current) onDragEndRef.current();
      // Notify parent once at terminate — syncs final curve position
      if (onChangeRef.current) onChangeRef.current(curvesRef.current);
    },
  }), []);

  const handleLayout = (e: LayoutChangeEvent) => {
    setCanvasSize({
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    });
  };

  const handleReset = () => {
    if (onDragStart) onDragStart();
    onChange({
      ...curves,
      [activeChannel]: [
        { x: 0, y: 0 }, { x: 0.25, y: 0.25 }, { x: 0.5, y: 0.5 },
        { x: 0.75, y: 0.75 }, { x: 1, y: 1 },
      ],
    });
    if (onDragEnd) onDragEnd();
  };

  const { w, h } = canvasSize;

  return (
    <View style={styles.container}>
      {/* Channel selector */}
      <View style={styles.channelRow}>
        {(['rgb', 'r', 'g', 'b'] as Channel[]).map(ch => (
          <TouchableOpacity
            key={ch}
            style={[
              styles.channelBtn,
              activeChannel === ch && {
                backgroundColor: CHANNEL_COLORS[ch] + '22',
                borderColor: CHANNEL_COLORS[ch],
              },
            ]}
            onPress={() => setActiveChannel(ch)}
          >
            <Text style={[
              styles.channelLabel,
              activeChannel === ch && { color: CHANNEL_COLORS[ch] },
            ]}>
              {ch.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetLabel}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View
        style={styles.canvas}
        onLayout={handleLayout}
        onTouchStart={(e) => {
          const { locationX, locationY } = e.nativeEvent;
          startTouchRef.current = { x: locationX, y: locationY, time: Date.now() };
        }}
        onTouchEnd={(e) => {
          if (draggingIdRef.current !== null) return;
          if (!startTouchRef.current) return;
          const { locationX, locationY } = e.nativeEvent;
          const dx = locationX - startTouchRef.current.x;
          const dy = locationY - startTouchRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const duration = Date.now() - startTouchRef.current.time;

          if (dist < 10 && duration < 300) {
            const closest = findClosestPoint(locationX, locationY);
            if (closest === -1) {
              if (onDragStartRef.current) onDragStartRef.current();
              const { w, h } = canvasSizeRef.current;
              const currentPts = pointsRef.current;
              const newPt: IdentifiablePoint = {
                id: `new_${Date.now()}_${Math.random()}`,
                x: Math.min(0.98, Math.max(0.02, locationX / w)),
                y: Math.min(1, Math.max(0, 1 - locationY / h)),
              };
              const newPts = [...currentPts, newPt].sort((a, b) => a.x - b.x);
              newPts[0] = { ...newPts[0], x: 0 };
              newPts[newPts.length - 1] = { ...newPts[newPts.length - 1], x: 1 };
              
              updatePoints(newPts, true);
              if (onDragEndRef.current) onDragEndRef.current();
            }
          }
          startTouchRef.current = null;
        }}
        onTouchCancel={() => {
          startTouchRef.current = null;
        }}
        {...panResponder.panHandlers}
      >
        {/* Grid lines */}
        {Array.from({ length: GRID - 1 }).map((_, i) => (
          <React.Fragment key={i}>
            <View style={[styles.gridLine, styles.gridH, { top: `${((i + 1) / GRID) * 100}%` }]} pointerEvents="none" />
            <View style={[styles.gridLine, styles.gridV, { left: `${((i + 1) / GRID) * 100}%` }]} pointerEvents="none" />
          </React.Fragment>
        ))}

        {/* Diagonal identity line */}
        <View style={styles.identityLine} pointerEvents="none">
          <View style={[styles.identityDash, { backgroundColor: '#334155' }]} />
        </View>

        {/* Curve polyline (rendered as thin horizontal scan) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {(() => {
            const lut = CurvesEngine.buildLUT(points);
            const wCeil = Math.ceil(w);
            return Array.from({ length: wCeil }).map((_, xi) => {
              const t = xi / (wCeil - 1);
              const lutIdx = Math.min(255, Math.round(t * 255));
              const y = (1 - lut[lutIdx]) * h;
              return (
                <View
                  key={xi}
                  style={{
                    position: 'absolute',
                    left: xi,
                    top: y - 1,
                    width: 1.5,
                    height: 1.5,
                    backgroundColor: accentColor,
                    borderRadius: 1,
                  }}
                />
              );
            });
          })().filter((_, i) => i % 2 === 0)}
        </View>

        {/* Control points */}
        {points.map((pt) => {
          const px = pt.x * w - 8;
          const py = (1 - pt.y) * h - 8;
          return (
            <View
              key={pt.id}
              pointerEvents="none"
              style={[
                styles.controlPoint,
                {
                  left: px,
                  top: py,
                  borderColor: accentColor,
                  backgroundColor: draggingId === pt.id ? accentColor : '#0F172A',
                },
              ]}
            />
          );
        })}
      </View>

      <Text style={styles.hint}>Tap to add · Drag to move · Long-press to remove</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  channelRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 6,
  },
  channelBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  channelLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
  },
  resetLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  canvas: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0A0F1C',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: '#1E293B',
  },
  gridH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  identityLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ rotate: '180deg' }],
  },
  identityDash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.3,
  },
  controlPoint: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  hint: {
    color: '#334155',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 6,
  },
});
