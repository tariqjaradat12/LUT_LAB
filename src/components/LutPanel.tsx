import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, NativeModules,
} from 'react-native';
import {
  LutState, ALL_LUT_PRESETS,
  importCubeContent, parseCubeFileResult, getLutDisplayName,
} from '../core/presets/LutPresets';
import { LutCustomizerPad } from './editor/LutCustomizerPad';
import { ToolSlider } from './editor/ToolSlider';

const { MediaPicker } = NativeModules;

const formatPercent = (v: number) => `${Math.round(v * 100)}%`;

interface LutPanelProps {
  lutState: LutState;
  onLutStateChange: (patch: Partial<LutState>) => void;
  accentColor: string;
  primaryText: string;
  secondaryText: string;
  cardTheme: string;
  borderTheme: string;
  isDark: boolean;
  onAddToDeck?: (name: string, params: { activeLutPresetId: string; customLutData?: number[]; customLutSize?: number }) => void;
  onScrollLockChange?: (locked: boolean) => void;
}

export const LutPanel: React.FC<LutPanelProps> = ({
  lutState,
  onLutStateChange,
  accentColor,
  primaryText,
  secondaryText,
  cardTheme,
  borderTheme,
  isDark,
  onAddToDeck,
  onScrollLockChange,
}) => {
  const [scrollLocked, setScrollLocked] = useState(false);

  const handleScrollLock = (locked: boolean) => {
    setScrollLocked(locked);
    onScrollLockChange?.(locked);
  };

  const updateField = <K extends keyof LutState>(key: K, value: LutState[K]) => {
    onLutStateChange({ [key]: value });
  };

  const handleImportCustomLut = async () => {
    if (!MediaPicker) {
      Alert.alert('Not Supported', 'MediaPicker native module is not available.');
      return;
    }
    try {
      const rawResult = await MediaPicker.pickCubeFile();
      const { content, name } = parseCubeFileResult(rawResult);
      const { lutState: patch, importedLut } = importCubeContent(
        content,
        name,
        lutState.importedLuts
      );
      onLutStateChange(patch);
      onAddToDeck?.(importedLut.name, {
        activeLutPresetId: importedLut.id,
        customLutData: importedLut.data,
        customLutSize: importedLut.size,
      });
      Alert.alert('LUT Applied', `Successfully imported and applied "${importedLut.name}"!`);
    } catch (e: any) {
      if (e.message !== 'Selection canceled' && e.code !== 'PICKER_CANCELED') {
        Alert.alert('Error', e.message || 'Failed to parse custom LUT file.');
      }
    }
  };

  const selectPreset = (id: string) => {
    const isActive = lutState.activeLutPresetId === id;
    if (isActive) {
      onLutStateChange({
        activeLutPresetId: null,
        lutColorOffset: 0,
        lutToneOffset: 0,
      });
      return;
    }

    const imported = lutState.importedLuts.find(l => l.id === id);
    if (imported) {
      onLutStateChange({
        activeLutPresetId: id,
        customLutData: imported.data,
        customLutSize: imported.size,
      });
    } else {
      onLutStateChange({
        activeLutPresetId: id,
        customLutData: null,
      });
    }
  };

  const importedPresetCards: Array<{ id: string; name: string; isCube: boolean }> =
    lutState.importedLuts.map(l => ({ id: l.id, name: l.name, isCube: true }));

  const allCards = [
    ...ALL_LUT_PRESETS.map(p => ({ ...p, isCube: p.id.startsWith('lut_') })),
    ...importedPresetCards,
  ];

  const activeName = getLutDisplayName(lutState.activeLutPresetId, lutState.importedLuts);

  return (
    <View style={styles.container} pointerEvents={scrollLocked ? 'box-none' : 'auto'}>
      <View style={[styles.panelCard, { backgroundColor: cardTheme, borderColor: borderTheme }]}>
        <Text style={[styles.panelCardTitle, { color: primaryText }]}>Import .cube LUT</Text>
        <Text style={[styles.panelCardDesc, { color: secondaryText }]}>
          Load a standard 3D LUT (.cube) from your phone and add it to your quick-access roster.
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: accentColor }]}
          onPress={handleImportCustomLut}
        >
          <Text style={styles.actionBtnText}>Pick .cube File</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: secondaryText }]}>Preset LUT Profiles</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={!scrollLocked}
        contentContainerStyle={styles.presetScroll}
      >
        {allCards.map(preset => {
          const isActive = lutState.activeLutPresetId === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.presetCard,
                { borderColor: borderTheme, backgroundColor: cardTheme },
                isActive && { borderColor: accentColor, backgroundColor: accentColor + '15' },
              ]}
              onPress={() => selectPreset(preset.id)}
            >
              <Text style={[styles.presetCardName, { color: primaryText }, isActive && { color: accentColor }]}>
                {preset.name}
              </Text>
              <Text style={[styles.presetCardType, { color: secondaryText }]}>
                {isActive ? 'ACTIVE' : preset.isCube ? '.CUBE' : 'SELECT'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {lutState.activeLutPresetId && (
        <View style={[styles.customizerCard, { backgroundColor: cardTheme, borderColor: borderTheme }]}>
          <View style={styles.customizerHeader}>
            <Text style={[styles.customizerTitle, { color: primaryText }]}>{activeName}</Text>
            <TouchableOpacity
              onPress={() => onLutStateChange({
                activeLutPresetId: null,
                lutColorOffset: 0,
                lutToneOffset: 0,
              })}
            >
              <Text style={{ color: secondaryText, fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <LutCustomizerPad
            colorOffset={lutState.lutColorOffset}
            toneOffset={lutState.lutToneOffset}
            onValuesChange={(colorVal, toneVal) => {
              onLutStateChange({ lutColorOffset: colorVal, lutToneOffset: toneVal });
            }}
            onDragStart={() => handleScrollLock(true)}
            onDragEnd={() => handleScrollLock(false)}
          />

          <View style={{ marginTop: 12 }}>
            <ToolSlider
              sliderKey="lutIntensity"
              label="Preset Blending Mix"
              value={lutState.lutIntensity}
              min={0}
              max={100}
              defaultValue={100}
              step={1}
              accentColor={accentColor}
              onValueChange={(_key, value) => updateField('lutIntensity', value ?? 100)}
              onDragStart={() => handleScrollLock(true)}
              onDragEnd={() => handleScrollLock(false)}
              formatValue={formatPercent}
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  panelCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  panelCardTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 6 },
  panelCardDesc: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  presetScroll: { gap: 10, paddingBottom: 4, marginBottom: 12 },
  presetCard: {
    width: 110,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  presetCardName: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  presetCardType: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  customizerCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
  },
  customizerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customizerTitle: { fontSize: 15, fontWeight: 'bold' },
});
