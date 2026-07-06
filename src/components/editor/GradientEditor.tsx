/**
 * GradientEditor — Interactive linear and circular gradient mask placement.
 * Linear: two endpoint handles connected by a draggable line.
 * Circular: draggable center + inner/outer radius rings.
 */
import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, PanResponder, GestureResponderEvent,
  TouchableOpacity, Switch,
} from 'react-native';
import {
  LinearGradientMask, CircularGradientMask,
} from '../../core/engine/EditingEngine';
import { ToolSlider } from './ToolSlider';

interface GradientEditorProps {
  linear: LinearGradientMask;
  circular: CircularGradientMask;
  onLinearChange: (m: LinearGradientMask) => void;
  onCircularChange: (m: CircularGradientMask) => void;
  // Tool-specific sliders to apply within the gradient
  gradientExposure: number;
  gradientSaturation: number;
  gradientTemperature: number;
  onGradientExposure: (v: number) => void;
  onGradientSaturation: (v: number) => void;
  onGradientTemperature: (v: number) => void;
}

type GradMode = 'linear' | 'circular';

export const GradientEditor: React.FC<GradientEditorProps> = ({
  linear, circular, onLinearChange, onCircularChange,
  gradientExposure, gradientSaturation, gradientTemperature,
  onGradientExposure, onGradientSaturation, onGradientTemperature,
}) => {
  const [mode, setMode] = React.useState<GradMode>('linear');
  const canvasRef = useRef({ w: 0, h: 0 });
  const dragging = useRef<string | null>(null);

  const accent = mode === 'linear' ? '#38BDF8' : '#A78BFA';

  // Pan responder for linear gradient start/end handles
  const linearPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      const { w, h } = canvasRef.current;
      if (!w) return;
      const lx = e.nativeEvent.locationX / w;
      const ly = e.nativeEvent.locationY / h;
      // Determine closest handle: start or end
      const dStart = Math.hypot(lx - linear.startX, ly - linear.startY);
      const dEnd = Math.hypot(lx - linear.endX, ly - linear.endY);
      dragging.current = dStart < dEnd ? 'start' : 'end';
    },
    onPanResponderMove: (e: GestureResponderEvent) => {
      const { w, h } = canvasRef.current;
      if (!w) return;
      const lx = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
      const ly = Math.min(1, Math.max(0, e.nativeEvent.locationY / h));
      if (dragging.current === 'start') {
        onLinearChange({ ...linear, startX: lx, startY: ly });
      } else {
        onLinearChange({ ...linear, endX: lx, endY: ly });
      }
    },
    onPanResponderRelease: () => { dragging.current = null; },
  });

  // Pan for circular: center drag or outer radius
  const circularPan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      const { w, h } = canvasRef.current;
      if (!w) return;
      const lx = e.nativeEvent.locationX / w;
      const ly = e.nativeEvent.locationY / h;
      const distCenter = Math.hypot(lx - circular.centerX, ly - circular.centerY);
      const minDim = Math.min(w, h);
      const outerPx = circular.outerRadius * minDim;
      const distPx = distCenter * minDim;
      dragging.current = Math.abs(distPx - outerPx) < 20 ? 'outer' : 'center';
    },
    onPanResponderMove: (e: GestureResponderEvent) => {
      const { w, h } = canvasRef.current;
      if (!w) return;
      const lx = Math.min(1, Math.max(0, e.nativeEvent.locationX / w));
      const ly = Math.min(1, Math.max(0, e.nativeEvent.locationY / h));
      if (dragging.current === 'center') {
        onCircularChange({ ...circular, centerX: lx, centerY: ly });
      } else {
        const minDim = Math.min(w, h);
        const dx = (lx - circular.centerX) * w;
        const dy = (ly - circular.centerY) * h;
        const newRadius = Math.min(1, Math.max(0.05, Math.hypot(dx, dy) / minDim));
        onCircularChange({ ...circular, outerRadius: newRadius });
      }
    },
    onPanResponderRelease: () => { dragging.current = null; },
  });

  // Compute pixel positions for rendering
  const [cw, ch] = [canvasRef.current.w || 280, canvasRef.current.h || 140];

  return (
    <View style={styles.container}>
      {/* Mode toggle */}
      <View style={styles.modeRow}>
        {(['linear', 'circular'] as GradMode[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && { backgroundColor: accent + '22', borderColor: accent }]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modeBtnLabel, mode === m && { color: accent }]}>
              {m === 'linear' ? '━ Linear' : '◎ Circular'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Enable toggle */}
      <View style={styles.enableRow}>
        <Text style={styles.enableLabel}>
          {mode === 'linear' ? 'Linear Gradient' : 'Circular Gradient'} Active
        </Text>
        <Switch
          value={mode === 'linear' ? linear.enabled : circular.enabled}
          onValueChange={v => {
            if (mode === 'linear') onLinearChange({ ...linear, enabled: v });
            else onCircularChange({ ...circular, enabled: v });
          }}
          trackColor={{ false: '#1E293B', true: accent + '88' }}
          thumbColor={accent}
        />
      </View>

      {/* Interactive canvas */}
      <View
        style={styles.canvas}
        onLayout={e => {
          canvasRef.current = {
            w: e.nativeEvent.layout.width,
            h: e.nativeEvent.layout.height,
          };
        }}
        {...(mode === 'linear' ? linearPan.panHandlers : circularPan.panHandlers)}
      >
        <Text style={styles.canvasHint}>
          {mode === 'linear' ? 'Drag handles to reposition gradient line' : 'Drag center · edge for radius'}
        </Text>

        {mode === 'linear' && (linear.enabled) && (
          <>
            {/* Line */}
            <View style={[
              styles.linearHandle,
              {
                left: linear.startX * cw - 10,
                top: linear.startY * ch - 10,
                borderColor: accent,
              },
            ]} />
            <View style={[
              styles.linearHandle,
              {
                left: linear.endX * cw - 10,
                top: linear.endY * ch - 10,
                borderColor: '#FBBF24',
              },
            ]} />
            <Text style={[styles.handleLabel, { left: linear.startX * cw + 10, top: linear.startY * ch - 8, color: accent }]}>Start</Text>
            <Text style={[styles.handleLabel, { left: linear.endX * cw + 10, top: linear.endY * ch - 8, color: '#FBBF24' }]}>End</Text>
          </>
        )}

        {mode === 'circular' && circular.enabled && (
          <>
            {/* Outer ring */}
            <View style={[
              styles.circularRing,
              {
                width: circular.outerRadius * Math.min(cw, ch) * 2,
                height: circular.outerRadius * Math.min(cw, ch) * 2,
                borderRadius: circular.outerRadius * Math.min(cw, ch),
                left: circular.centerX * cw - circular.outerRadius * Math.min(cw, ch),
                top: circular.centerY * ch - circular.outerRadius * Math.min(cw, ch),
                borderColor: accent,
              },
            ]} />
            {/* Center dot */}
            <View style={[
              styles.circularCenter,
              {
                left: circular.centerX * cw - 8,
                top: circular.centerY * ch - 8,
                backgroundColor: accent,
              },
            ]} />
          </>
        )}
      </View>

      {/* Effect sliders applied within gradient */}
      <View style={styles.effectSliders}>
        <Text style={[styles.effectTitle, { color: accent }]}>Effect within Gradient</Text>
        <ToolSlider
          label="Exposure"
          value={gradientExposure}
          min={-4} max={4} defaultValue={0} step={0.1}
          accentColor={accent}
          onValueChange={onGradientExposure}
        />
        <ToolSlider
          label="Saturation"
          value={gradientSaturation}
          min={-100} max={100} defaultValue={0} step={1}
          accentColor={accent}
          onValueChange={onGradientSaturation}
        />
        <ToolSlider
          label="Temperature"
          value={gradientTemperature}
          min={-100} max={100} defaultValue={0} step={1}
          accentColor={accent}
          onValueChange={onGradientTemperature}
        />
        {mode === 'linear' && (
          <ToolSlider
            label="Feather"
            value={linear.feather}
            min={0} max={1} defaultValue={0.3} step={0.01}
            accentColor={accent}
            onValueChange={v => onLinearChange({ ...linear, feather: v })}
          />
        )}
        {mode === 'circular' && (
          <>
            <ToolSlider
              label="Inner Radius"
              value={circular.innerRadius}
              min={0} max={0.9} defaultValue={0.1} step={0.01}
              accentColor={accent}
              onValueChange={v => onCircularChange({ ...circular, innerRadius: v })}
            />
            <ToolSlider
              label="Feather"
              value={circular.feather}
              min={0} max={1} defaultValue={0.2} step={0.01}
              accentColor={accent}
              onValueChange={v => onCircularChange({ ...circular, feather: v })}
            />
          </>
        )}
        <View style={styles.invertRow}>
          <Text style={styles.invertLabel}>Invert Mask</Text>
          <Switch
            value={mode === 'linear' ? linear.inverted : circular.inverted}
            onValueChange={v => {
              if (mode === 'linear') onLinearChange({ ...linear, inverted: v });
              else onCircularChange({ ...circular, inverted: v });
            }}
            trackColor={{ false: '#1E293B', true: accent + '88' }}
            thumbColor={accent}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  modeBtnLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  enableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  enableLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  canvas: {
    width: '100%',
    height: 140,
    backgroundColor: '#0A0F1C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  canvasHint: {
    color: '#334155',
    fontSize: 11,
    textAlign: 'center',
  },
  linearHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  handleLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: 'bold',
  },
  circularRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  circularCenter: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    opacity: 0.9,
  },
  effectSliders: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 0,
  },
  effectTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  invertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  invertLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
