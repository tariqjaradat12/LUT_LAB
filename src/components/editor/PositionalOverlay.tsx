/**
 * PositionalOverlay — Touch-driven overlay for placing positional effects.
 * Renders draggable center points, resize rings, and captures brush strokes.
 */
import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, PanResponder, GestureResponderEvent, PanResponderGestureState,
} from 'react-native';
import { Point2D, ControlPoint } from '../../core/engine/EditingEngine';

interface PositionalOverlayProps {
  mode: 'point' | 'circle' | 'controlpoint' | 'brush' | 'lineargradient';
  center: Point2D;
  end?: Point2D;
  radius?: number;
  focalY?: number;
  accentColor?: string;
  onCenterChange: (pt: Point2D, id?: string | null) => void;
  onEndChange?: (pt: Point2D) => void;
  onRadiusChange?: (r: number) => void;
  onFocalYChange?: (y: number) => void;
  canvasWidth: number;
  canvasHeight: number;

  // Custom props for regions & brush masking
  controlPoints?: ControlPoint[];
  activeControlPointId?: string | null;
  onAddControlPoint?: (pt: Point2D) => void;
  onSelectControlPoint?: (id: string | null) => void;
  onBrushStroke?: (x: number, y: number, radius: number, isStart: boolean) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
}

export const PositionalOverlay: React.FC<PositionalOverlayProps> = ({
  mode,
  center,
  end,
  radius = 0.3,
  focalY = 0.5,
  accentColor = '#6366F1',
  onCenterChange,
  onEndChange,
  onRadiusChange,
  onFocalYChange,
  canvasWidth,
  canvasHeight,
  controlPoints = [],
  activeControlPointId = null,
  onAddControlPoint,
  onSelectControlPoint,
  onBrushStroke,
  onInteractionStart,
  onInteractionEnd,
}) => {
  const draggingRadius = useRef(false);
  const grabbedPointId = useRef<string | null>(null);
  const draggedHandle = useRef<'start' | 'end' | null>(null);

  // Refs for tracking start position to compute deltas stably
  const dragStartPos = useRef<Point2D>({ x: 0.5, y: 0.5 });
  const dragStartRadius = useRef<number>(0.3);
  const dragStartFocalY = useRef<number>(0.5);

  const centerPx = { x: center.x * canvasWidth, y: center.y * canvasHeight };
  const radiusPx = radius * Math.min(canvasWidth, canvasHeight);
  const focalYPx = focalY * canvasHeight;

  // Use a ref to capture the absolute latest props to avoid stale closures in PanResponders
  const latest = useRef({
    mode,
    center,
    end,
    radius,
    focalY,
    canvasWidth,
    canvasHeight,
    controlPoints,
    activeControlPointId,
    onCenterChange,
    onEndChange,
    onRadiusChange,
    onFocalYChange,
    onBrushStroke,
    onSelectControlPoint,
    onAddControlPoint,
    onInteractionStart,
    onInteractionEnd,
  });

  latest.current = {
    mode,
    center,
    end,
    radius,
    focalY,
    canvasWidth,
    canvasHeight,
    controlPoints,
    activeControlPointId,
    onCenterChange,
    onEndChange,
    onRadiusChange,
    onFocalYChange,
    onBrushStroke,
    onSelectControlPoint,
    onAddControlPoint,
    onInteractionStart,
    onInteractionEnd,
  };

  // Center point / Tap / Brush pan responder
  const centerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (e) => {
        const { mode, center, end, radius, canvasWidth, canvasHeight, controlPoints, activeControlPointId, onCenterChange, onBrushStroke, onSelectControlPoint, onAddControlPoint, onInteractionStart } = latest.current;
        onInteractionStart?.();

        const { locationX, locationY } = e.nativeEvent;
        const tx = locationX / canvasWidth;
        const ty = locationY / canvasHeight;

        if (mode === 'lineargradient' && end) {
          const startX = center.x * canvasWidth;
          const startY = center.y * canvasHeight;
          const endX = end.x * canvasWidth;
          const endY = end.y * canvasHeight;
          const clickX = locationX;
          const clickY = locationY;

          const distStart = Math.sqrt(Math.pow(clickX - startX, 2) + Math.pow(clickY - startY, 2));
          const distEnd = Math.sqrt(Math.pow(clickX - endX, 2) + Math.pow(clickY - endY, 2));

          if (distStart <= distEnd) {
            draggedHandle.current = 'start';
            dragStartPos.current = { x: center.x, y: center.y };
          } else {
            draggedHandle.current = 'end';
            dragStartPos.current = { x: end.x, y: end.y };
          }
        } else if (mode === 'brush') {
          dragStartPos.current = { x: tx, y: ty };
          onBrushStroke?.(tx, ty, radius, true);
        } else if (mode === 'controlpoint') {
          let foundId: string | null = null;
          let grabbedCp: ControlPoint | null = null;
          for (const cp of controlPoints) {
            const dx = (cp.x - tx) * canvasWidth;
            const dy = (cp.y - ty) * canvasHeight;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 44) {
              foundId = cp.id;
              grabbedCp = cp;
              break;
            }
          }
          grabbedPointId.current = foundId;
          if (grabbedCp) {
            dragStartPos.current = { x: grabbedCp.x, y: grabbedCp.y };
            if (foundId !== activeControlPointId) {
              onSelectControlPoint?.(foundId);
            }
          } else if (activeControlPointId) {
            const activeCp = controlPoints.find(cp => cp.id === activeControlPointId);
            if (activeCp) {
              dragStartPos.current = { x: activeCp.x, y: activeCp.y };
              grabbedPointId.current = activeControlPointId;
            } else {
              dragStartPos.current = { x: tx, y: ty };
            }
          } else {
            dragStartPos.current = { x: tx, y: ty };
          }
        } else {
          dragStartPos.current = { x: tx, y: ty };
          onCenterChange({ x: tx, y: ty });
        }
      },
      onPanResponderMove: (e, gestureState) => {
        const { mode, end, canvasWidth, canvasHeight, activeControlPointId, onCenterChange, onEndChange, onBrushStroke } = latest.current;
        const tx = Math.min(1.0, Math.max(0.0, dragStartPos.current.x + gestureState.dx / canvasWidth));
        const ty = Math.min(1.0, Math.max(0.0, dragStartPos.current.y + gestureState.dy / canvasHeight));

        if (mode === 'lineargradient' && end) {
          if (draggedHandle.current === 'start') {
            onCenterChange({ x: tx, y: ty });
          } else if (draggedHandle.current === 'end') {
            onEndChange?.({ x: tx, y: ty });
          }
        } else if (mode === 'brush') {
          onBrushStroke?.(tx, ty, radius, false);
        } else if (mode === 'controlpoint') {
          const activeId = grabbedPointId.current || activeControlPointId;
          if (activeId) {
            onCenterChange({ x: tx, y: ty }, activeId);
          }
        } else {
          onCenterChange({ x: tx, y: ty });
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        const { mode, canvasWidth, canvasHeight, controlPoints, activeControlPointId, onSelectControlPoint, onAddControlPoint, onInteractionEnd } = latest.current;
        const { locationX, locationY } = e.nativeEvent;
        const tx = Math.min(1.0, Math.max(0.0, locationX / canvasWidth));
        const ty = Math.min(1.0, Math.max(0.0, locationY / canvasHeight));

        draggedHandle.current = null;
        if (mode === 'controlpoint') {
          const moveDist = Math.sqrt(gestureState.dx * gestureState.dx + gestureState.dy * gestureState.dy);
          if (moveDist < 8.0) {
            let tappedPointId: string | null = null;
            for (const cp of controlPoints) {
              const dx = (cp.x - tx) * canvasWidth;
              const dy = (cp.y - ty) * canvasHeight;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 44) {
                tappedPointId = cp.id;
                break;
              }
            }
            if (tappedPointId) {
              onSelectControlPoint?.(tappedPointId);
            } else {
              onAddControlPoint?.({ x: tx, y: ty });
            }
          }
          grabbedPointId.current = null;
        }
        onInteractionEnd?.();
      },
      onPanResponderTerminate: () => {
        draggedHandle.current = null;
        grabbedPointId.current = null;
        latest.current.onInteractionEnd?.();
      }
    })
  ).current;

  // Radius ring pan responder
  const radiusPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { radius, onInteractionStart } = latest.current;
        onInteractionStart?.();
        draggingRadius.current = true;
        dragStartRadius.current = radius;
      },
      onPanResponderRelease: () => {
        draggingRadius.current = false;
        latest.current.onInteractionEnd?.();
      },
      onPanResponderTerminate: () => {
        draggingRadius.current = false;
        latest.current.onInteractionEnd?.();
      },
      onPanResponderMove: (e, gestureState) => {
        const { canvasWidth, canvasHeight, onRadiusChange } = latest.current;
        const startRadiusPx = dragStartRadius.current * Math.min(canvasWidth, canvasHeight);
        const dx = startRadiusPx + gestureState.dx;
        const dy = gestureState.dy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDim = Math.min(canvasWidth, canvasHeight);
        const newRadius = Math.min(1.0, Math.max(0.05, dist / minDim));
        onRadiusChange?.(newRadius);
      },
    })
  ).current;

  // Focal line pan responder
  const focalPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { focalY, onInteractionStart } = latest.current;
        onInteractionStart?.();
        dragStartFocalY.current = focalY;
      },
      onPanResponderRelease: () => {
        latest.current.onInteractionEnd?.();
      },
      onPanResponderTerminate: () => {
        latest.current.onInteractionEnd?.();
      },
      onPanResponderMove: (e, gestureState) => {
        const { canvasHeight, onFocalYChange } = latest.current;
        onFocalYChange?.(Math.min(1.0, Math.max(0.0, dragStartFocalY.current + gestureState.dy / canvasHeight)));
      },
    })
  ).current;

  return (
    <View style={[styles.overlay, { width: canvasWidth, height: canvasHeight }]}>
      {/* Full overlay touch area for center dragging/tapping/brushing */}
      <View style={StyleSheet.absoluteFill} {...centerPan.panHandlers} />

      {mode === 'lineargradient' && end && (() => {
        const startPxX = center.x * canvasWidth;
        const startPxY = center.y * canvasHeight;
        const endPxX = end.x * canvasWidth;
        const endPxY = end.y * canvasHeight;
        const lgDx = endPxX - startPxX;
        const lgDy = endPxY - startPxY;
        const lgLength = Math.sqrt(lgDx * lgDx + lgDy * lgDy);
        const lgAngleRad = Math.atan2(lgDy, lgDx);
        const lgAngleDeg = (lgAngleRad * 180) / Math.PI;
        const lgMidX = (startPxX + endPxX) / 2;
        const lgMidY = (startPxY + endPxY) / 2;
        return (
          <>
            {/* Connector line */}
            <View
              pointerEvents="none"
              style={[
                styles.gradientLine,
                {
                  left: lgMidX - lgLength / 2,
                  top: lgMidY - 1,
                  width: lgLength,
                  borderColor: accentColor,
                  transform: [{ rotate: `${lgAngleDeg}deg` }],
                },
              ]}
            />

            {/* Start handle */}
            <View
              pointerEvents="none"
              style={[
                styles.gradientHandle,
                {
                  left: startPxX - 18,
                  top: startPxY - 18,
                  borderColor: accentColor,
                },
              ]}
            >
              <Text style={styles.handleText}>S</Text>
            </View>

            {/* End handle */}
            <View
              pointerEvents="none"
              style={[
                styles.gradientHandle,
                {
                  left: endPxX - 18,
                  top: endPxY - 18,
                  borderColor: accentColor,
                },
              ]}
            >
              <Text style={styles.handleText}>E</Text>
            </View>
          </>
        );
      })()}



      {/* Render all control points */}
      {mode === 'controlpoint' && controlPoints.map(cp => {
        const isActive = cp.id === activeControlPointId;
        const cpX = cp.x * canvasWidth;
        const cpY = cp.y * canvasHeight;
        return (
          <View
            key={cp.id}
            style={[
              styles.cpIndicator,
              {
                left: cpX - 12,
                top: cpY - 12,
                borderColor: isActive ? '#F43F5E' : '#94A3B8',
                backgroundColor: isActive ? 'rgba(244,63,94,0.45)' : 'rgba(15,23,42,0.85)',
              }
            ]}
            pointerEvents="none"
          >
            <Text style={styles.cpText}>+</Text>
          </View>
        );
      })}

      {(mode === 'point' || mode === 'circle' || mode === 'controlpoint') && (
        <>
          {/* Radius ring */}
          {(mode === 'circle' || mode === 'controlpoint') && (
            <View
              style={[
                styles.radiusRing,
                {
                  width: radiusPx * 2,
                  height: radiusPx * 2,
                  borderRadius: radiusPx,
                  borderColor: accentColor,
                  left: centerPx.x - radiusPx,
                  top: centerPx.y - radiusPx,
                },
              ]}
              {...radiusPan.panHandlers}
            />
          )}

          {/* Crosshair center dot */}
          <View
            style={[
              styles.centerDot,
              {
                left: centerPx.x - 16,
                top: centerPx.y - 16,
                borderColor: accentColor,
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.crossH, { backgroundColor: accentColor }]} />
            <View style={[styles.crossV, { backgroundColor: accentColor }]} />
          </View>

          {/* Resize handle on the ring */}
          {(mode === 'circle' || mode === 'controlpoint') && (
            <View
              style={[
                styles.resizeHandle,
                {
                  left: centerPx.x + radiusPx - 10,
                  top: centerPx.y - 10,
                  backgroundColor: accentColor,
                },
              ]}
              {...radiusPan.panHandlers}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 20,
    height: 2,
    borderRadius: 1,
  },
  crossV: {
    position: 'absolute',
    width: 2,
    height: 20,
    borderRadius: 1,
  },
  radiusRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  resizeHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.9,
  },
  focalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
  },
  focalHandle: {
    position: 'absolute',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  focalLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  blurZone: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cpIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 1.5,
    elevation: 3,
  },
  cpText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  gradientLine: {
    position: 'absolute',
    height: 2,
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  gradientHandle: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(56,189,248,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 5,
  },
  handleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
