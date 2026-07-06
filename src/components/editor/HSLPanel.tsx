/**
 * HSLPanel — 8-band Hue/Saturation/Luminance adjustment panel.
 * Each color band has individual H/S/L sliders.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { HueBand, HSLAdjustments } from '../../core/engine/EditingEngine';
import { ToolSlider } from './ToolSlider';

interface HSLPanelProps {
  hsl: HSLAdjustments;
  onChange: (hsl: HSLAdjustments) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  btnStepSize?: number;
}

const BANDS: { key: HueBand; label: string; color: string }[] = [
  { key: 'red',     label: 'Red',     color: '#F87171' },
  { key: 'orange',  label: 'Orange',  color: '#FB923C' },
  { key: 'yellow',  label: 'Yellow',  color: '#FBBF24' },
  { key: 'green',   label: 'Green',   color: '#4ADE80' },
  { key: 'cyan',    label: 'Cyan',    color: '#22D3EE' },
  { key: 'blue',    label: 'Blue',    color: '#60A5FA' },
  { key: 'purple',  label: 'Purple',  color: '#C084FC' },
  { key: 'magenta', label: 'Magenta', color: '#F472B6' },
];

export const HSLPanel: React.FC<HSLPanelProps> = ({ hsl, onChange, onDragStart, onDragEnd, btnStepSize }) => {
  const [activeBand, setActiveBand] = useState<HueBand>('red');
  const band = hsl[activeBand];
  const bandMeta = BANDS.find(b => b.key === activeBand)!;

  const updateBand = (field: 'hue' | 'saturation' | 'luminance', val: number) => {
    onChange({
      ...hsl,
      [activeBand]: { ...band, [field]: val },
    });
  };

  const resetBand = () => {
    if (onDragStart) onDragStart();
    onChange({
      ...hsl,
      [activeBand]: { hue: 0, saturation: 0, luminance: 0 },
    });
    if (onDragEnd) onDragEnd();
  };

  const isModified = (b: HueBand) => {
    const adj = hsl[b];
    return adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0;
  };

  return (
    <View style={styles.container}>
      {/* Band selector chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.bandRow}
      >
        {BANDS.map(b => (
          <TouchableOpacity
            key={b.key}
            style={[
              styles.bandChip,
              activeBand === b.key && {
                backgroundColor: b.color + '22',
                borderColor: b.color,
              },
            ]}
            onPress={() => setActiveBand(b.key)}
          >
            <View style={[styles.bandDot, { backgroundColor: b.color }]} />
            <Text style={[
              styles.bandLabel,
              activeBand === b.key && { color: b.color },
            ]}>
              {b.label}
            </Text>
            {isModified(b.key) && (
              <View style={[styles.modifiedDot, { backgroundColor: b.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Active band sliders */}
      <View style={[styles.slidersCard, { borderColor: bandMeta.color + '33' }]}>
        <View style={styles.bandHeader}>
          <Text style={[styles.bandTitle, { color: bandMeta.color }]}>
            {bandMeta.label} Range
          </Text>
          <TouchableOpacity onPress={resetBand} style={styles.resetBtn}>
            <Text style={[styles.resetLabel, { color: bandMeta.color }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ToolSlider
          label="Hue"
          value={band.hue}
          min={-180}
          max={180}
          defaultValue={0}
          step={1}
          accentColor={bandMeta.color}
          formatValue={v => v === 0 ? '0°' : `${v > 0 ? '+' : ''}${v}°`}
          onValueChange={v => updateBand('hue', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          btnStepSize={btnStepSize}
        />
        <ToolSlider
          label="Saturation"
          value={band.saturation}
          min={-100}
          max={100}
          defaultValue={0}
          step={1}
          accentColor={bandMeta.color}
          onValueChange={v => updateBand('saturation', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          btnStepSize={btnStepSize}
        />
        <ToolSlider
          label="Luminance"
          value={band.luminance}
          min={-100}
          max={100}
          defaultValue={0}
          step={1}
          accentColor={bandMeta.color}
          onValueChange={v => updateBand('luminance', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          btnStepSize={btnStepSize}
        />
      </View>

      {/* All-bands summary */}
      <View style={styles.summary}>
        {BANDS.filter(b => isModified(b.key)).map(b => (
          <View key={b.key} style={[styles.summaryChip, { borderColor: b.color + '44' }]}>
            <View style={[styles.bandDot, { backgroundColor: b.color }]} />
            <Text style={[styles.summaryText, { color: b.color }]}>
              {b.label.slice(0, 3)}
              {hsl[b.key].hue !== 0 ? ` H${hsl[b.key].hue > 0 ? '+' : ''}${hsl[b.key].hue}` : ''}
              {hsl[b.key].saturation !== 0 ? ` S${hsl[b.key].saturation > 0 ? '+' : ''}${hsl[b.key].saturation}` : ''}
              {hsl[b.key].luminance !== 0 ? ` L${hsl[b.key].luminance > 0 ? '+' : ''}${hsl[b.key].luminance}` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  bandRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  bandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
    gap: 5,
  },
  bandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bandLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  modifiedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginLeft: 2,
  },
  slidersCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  bandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  bandTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  resetLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#0A0F1C',
    gap: 4,
  },
  summaryText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
