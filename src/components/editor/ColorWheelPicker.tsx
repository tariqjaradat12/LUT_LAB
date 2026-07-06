/**
 * ColorWheelPicker — 3-way color wheel grading component.
 * Renders a circular hue/saturation picker with a luminance (lift) slider.
 * Pure React Native — no third-party deps.
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, PanResponder, GestureResponderEvent,
  LayoutChangeEvent, TouchableOpacity,
} from 'react-native';
import { ColorWheelValue, ColorWheels } from '../../core/engine/EditingEngine';
import { ToolSlider } from './ToolSlider';
import { gradingBus } from '../../core/engine/GradingBus';

type WheelKey = 'shadows' | 'midtones' | 'highlights';

interface ColorWheelPickerProps {
  wheels: ColorWheels;
  onChange: (wheels: ColorWheels) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const WHEEL_LABELS: Record<WheelKey, { label: string; accent: string }> = {
  shadows:    { label: 'Shadows',    accent: '#60A5FA' },
  midtones:   { label: 'Midtones',   accent: '#A78BFA' },
  highlights: { label: 'Highlights', accent: '#FBBF24' },
};

const WheelPicker: React.FC<{
  value: ColorWheelValue;
  label: string;
  accent: string;
  onChange: (v: ColorWheelValue) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}> = ({ value, label, accent, onChange, onDragStart, onDragEnd }) => {
  const sizeRef = useRef(0);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e: GestureResponderEvent) => {
      if (onDragStart) onDragStart();
      handleTouch(e);
    },
    onPanResponderMove: (e: GestureResponderEvent) => handleTouch(e),
    onPanResponderRelease: () => {
      if (onDragEnd) onDragEnd();
    },
    onPanResponderTerminate: () => {
      if (onDragEnd) onDragEnd();
    },
  });

  const handleTouch = (e: GestureResponderEvent) => {
    const size = sizeRef.current;
    if (!size) return;
    const cx = size / 2;
    const cy = size / 2;
    const dx = e.nativeEvent.locationX - cx;
    const dy = e.nativeEvent.locationY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxR = size / 2;
    const sat = Math.min(1, dist / maxR);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    onChange({ ...value, hue, saturation: sat });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    sizeRef.current = e.nativeEvent.layout.width;
  };

  // Compute thumb position from current hue/saturation
  const size = sizeRef.current || 100;
  const cx = size / 2;
  const hueRad = (value.hue * Math.PI) / 180;
  const thumbX = cx + Math.cos(hueRad) * value.saturation * cx - 8;
  const thumbY = cx + Math.sin(hueRad) * value.saturation * cx - 8;

  // Build a rainbow ring from concentric gradient slices (JS-only approach)
  const segments = 36;
  const segDeg = 360 / segments;

  return (
    <View style={styles.wheelWrapper}>
      <Text style={[styles.wheelLabel, { color: accent }]}>{label}</Text>

      {/* Wheel */}
      <View
        style={styles.wheel}
        onLayout={handleLayout}
        {...panResponder.panHandlers}
      >
        {/* Gradient ring segments */}
        {Array.from({ length: segments }).map((_, i) => {
          const angle = i * segDeg;
          const hsl = `hsl(${angle}, 100%, 55%)`;
          const rad = (angle * Math.PI) / 180;
          const radius = 42;
          const segX = 50 + Math.cos(rad) * radius;
          const segY = 50 + Math.sin(rad) * radius;
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                width: 14,
                height: 14,
                borderRadius: 7,
                left: `${segX - 7}%`,
                top: `${segY - 7}%`,
                backgroundColor: `hsl(${angle}, 90%, 55%)`,
                opacity: 0.85,
              }}
            />
          );
        })}

        {/* White center (neutral) */}
        <View style={styles.wheelCenter} />

        {/* Thumb indicator */}
        <View
          style={[
            styles.thumb,
            {
              left: thumbX,
              top: thumbY,
              borderColor: accent,
            },
          ]}
        />
      </View>

      {/* Luminance slider */}
      <ToolSlider
        label="Lift"
        value={value.luminance}
        min={-1}
        max={1}
        defaultValue={0}
        step={0.01}
        accentColor={accent}
        onValueChange={v => onChange({ ...value, luminance: v })}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        formatValue={v => v === 0 ? '0' : v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2)}
      />

      {/* Reset */}
      <TouchableOpacity
        style={[styles.resetBtn, { borderColor: accent + '44' }]}
        onPress={() => {
          if (onDragStart) onDragStart();
          onChange({ hue: 0, saturation: 0, luminance: 0 });
        }}
      >
        <Text style={[styles.resetLabel, { color: accent }]}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
};

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({ wheels, onChange, onDragStart, onDragEnd }) => {
  const [localWheels, setLocalWheels] = useState<ColorWheels>(wheels);
  const wheelsRef = useRef(wheels);
  
  useEffect(() => {
    setLocalWheels(wheels);
    wheelsRef.current = wheels;
  }, [wheels]);

  const updateBus = (updated: ColorWheels) => {
    const arr = [
      updated.shadows.hue,
      updated.shadows.saturation,
      updated.shadows.luminance,
      updated.midtones.hue,
      updated.midtones.saturation,
      updated.midtones.luminance,
      updated.highlights.hue,
      updated.highlights.saturation,
      updated.highlights.luminance,
    ];
    gradingBus.set('colorWheels', arr);
  };

  const update = (key: WheelKey, v: ColorWheelValue) => {
    const nextWheels = { ...wheelsRef.current, [key]: v };
    setLocalWheels(nextWheels);
    wheelsRef.current = nextWheels;
    updateBus(nextWheels);
  };

  const handleDragEnd = () => {
    if (onDragEnd) onDragEnd();
    onChange(wheelsRef.current);
  };

  return (
    <View style={styles.container}>
      {(Object.keys(WHEEL_LABELS) as WheelKey[]).map(key => (
        <WheelPicker
          key={key}
          value={localWheels[key]}
          label={WHEEL_LABELS[key].label}
          accent={WHEEL_LABELS[key].accent}
          onChange={v => update(key, v)}
          onDragStart={onDragStart}
          onDragEnd={handleDragEnd}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  wheelWrapper: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  wheelLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  wheel: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: '#1a1a2a',
    alignSelf: 'center',
    maxWidth: 180,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  wheelCenter: {
    position: 'absolute',
    left: '35%',
    top: '35%',
    width: '30%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: '#F8FAFC',
    opacity: 0.08,
  },
  thumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 5,
  },
  resetBtn: {
    marginTop: 6,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
