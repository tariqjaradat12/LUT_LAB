/**
 * ToolSlider — Premium reusable button-based adjuster component.
 * Features: label, live value display, [-] and [+] adjustment buttons, visual track/thumb, double-tap to reset.
 */
import React, { useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { gradingBus } from '../../core/engine/GradingBus';

interface ToolSliderProps {
  sliderKey?: any; // Optional key for tracking updates in gradingBus
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue?: number;
  step?: number;
  formatValue?: (v: number) => string;
  accentColor?: string;
  onValueChange: (keyOrValue: any, value?: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  btnStepSize?: number;
}

const ToolSliderComponent: React.FC<ToolSliderProps> = ({
  sliderKey,
  label,
  value,
  min,
  max,
  defaultValue = 0,
  step = 1,
  formatValue,
  accentColor = '#6366F1',
  onValueChange,
  onDragStart,
  onDragEnd,
  btnStepSize,
}) => {
  const lastTapRef = useRef(0);
  const [localVal, setLocalVal] = React.useState(value);

  React.useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const normalize = (v: number) => (v - min) / (max - min);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const snapToStep = (v: number) => {
    if (step === 0) return v;
    return Math.round(v / step) * step;
  };

  const triggerValueChange = useCallback((v: number) => {
    if (sliderKey !== undefined) {
      onValueChange(sliderKey, v);
    } else {
      (onValueChange as any)(v);
    }
  }, [sliderKey, onValueChange]);

  const handleDecrement = () => {
    if (onDragStart) onDragStart();
    const multiplier = btnStepSize ?? 5;
    const change = step * multiplier;
    const nextVal = clamp(snapToStep(localVal - change));
    setLocalVal(nextVal);
    if (sliderKey !== undefined) {
      gradingBus.set(sliderKey, nextVal);
    }
    triggerValueChange(nextVal);
    if (onDragEnd) onDragEnd();
  };

  const handleIncrement = () => {
    if (onDragStart) onDragStart();
    const multiplier = btnStepSize ?? 5;
    const change = step * multiplier;
    const nextVal = clamp(snapToStep(localVal + change));
    setLocalVal(nextVal);
    if (sliderKey !== undefined) {
      gradingBus.set(sliderKey, nextVal);
    }
    triggerValueChange(nextVal);
    if (onDragEnd) onDragEnd();
  };

  const handleTrackPress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (onDragStart) onDragStart();
      if (sliderKey !== undefined) {
        gradingBus.set(sliderKey, defaultValue);
      }
      triggerValueChange(defaultValue);
      setLocalVal(defaultValue);
      if (onDragEnd) onDragEnd();
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
  };

  const fillPercent = `${Math.round(normalize(localVal) * 100)}%`;
  const isCentered = defaultValue !== min && Math.abs(defaultValue - (min + max) / 2) < 0.01 * (max - min);

  const displayValue = formatValue
    ? formatValue(localVal)
    : localVal === 0
    ? '0'
    : localVal > 0
    ? `+${localVal.toFixed(step < 0.1 ? 2 : 0)}`
    : `${localVal.toFixed(step < 0.1 ? 2 : 0)}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueText, { color: accentColor }]}>{displayValue}</Text>
      </View>

      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={styles.adjustButton}
          onPress={handleDecrement}
          activeOpacity={0.6}
        >
          <Text style={[styles.adjustButtonText, { color: accentColor }]}>-</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.trackContainer}
          onPress={handleTrackPress}
          activeOpacity={1}
        >
          <View style={styles.track} pointerEvents="none">
            {/* Background track */}
            <View style={styles.trackBg} />

            {isCentered ? (
              /* Center-origin fill (bidirectional) */
              <>
                {localVal < defaultValue ? (
                  <View
                    style={[
                      styles.fillCenter,
                      {
                        backgroundColor: accentColor,
                        right: '50%',
                        left: `${normalize(localVal) * 100}%` as any,
                      },
                    ]}
                  />
                ) : (
                  <View
                    style={[
                      styles.fillCenter,
                      {
                        backgroundColor: accentColor,
                        left: '50%',
                        right: `${(1 - normalize(localVal)) * 100}%` as any,
                      },
                    ]}
                  />
                )}
                <View style={[styles.centerTick, { backgroundColor: accentColor }]} />
              </>
            ) : (
              /* Left-origin fill */
              <View
                style={[styles.fill, { width: fillPercent as any, backgroundColor: accentColor }]}
              />
            )}

            {/* Thumb */}
            <View
              style={[
                styles.thumb,
                {
                  left: fillPercent as any,
                  borderColor: accentColor,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.adjustButton}
          onPress={handleIncrement}
          activeOpacity={0.6}
        >
          <Text style={[styles.adjustButtonText, { color: accentColor }]}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.rangeRow}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeHint}>double-tap track to reset</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>
    </View>
  );
};

export const ToolSlider = React.memo(ToolSliderComponent);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueText: {
    fontSize: 11,
    fontWeight: 'bold',
    minWidth: 35,
    textAlign: 'right',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1E1E24',
    borderColor: '#3E3E42',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 22,
    textAlign: 'center',
  },
  trackContainer: {
    flex: 1,
    height: 38,
    justifyContent: 'center',
  },
  track: {
    height: 20,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#262626',
  },
  fill: {
    position: 'absolute',
    left: 0,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  fillCenter: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 6,
    borderRadius: 1,
    marginLeft: -1,
    opacity: 0.5,
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#F8FAFC',
    marginLeft: -7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeText: {
    color: '#404040',
    fontSize: 9,
  },
  rangeHint: {
    color: '#404040',
    fontSize: 8,
    fontStyle: 'italic',
  },
});
