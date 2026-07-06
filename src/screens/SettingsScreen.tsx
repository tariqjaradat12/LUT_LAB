import React, { useRef, useState, useEffect } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, NativeModules, Platform, StatusBar,
} from 'react-native';
import { ThemeName, getThemeStyles } from '../core/theme';
import { ToolSlider } from '../components/editor/ToolSlider';

const { MediaPicker, LutShare } = NativeModules;

// Helper to convert HSL to Hex
const hslToHex = (h: number, s: number, l: number): string => {
  const lNorm = l / 100;
  const a = (s * Math.min(lNorm, 1 - lNorm)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = lNorm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

interface SpectrumPickerProps {
  hueVal: number;
  setHueVal: (hue: number) => void;
  onUpdateAccentColor: (accent: string | null) => void;
  accent: string;
  secondaryText: string;
  borderTheme: string;
}

const SpectrumPicker: React.FC<SpectrumPickerProps> = ({
  hueVal,
  setHueVal,
  onUpdateAccentColor,
  accent,
  secondaryText,
  borderTheme,
}) => {
  const barWidthRef = useRef<number>(0);
  
  const handleBarTouch = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, x / (barWidthRef.current || 200)));
    const hue = Math.round(pct * 360);
    setHueVal(hue);
    onUpdateAccentColor(hslToHex(hue, 95, 60));
  };

  return (
    <View style={{ marginVertical: 12 }}>
      <Text style={[styles.subSectionTitle, { color: secondaryText }]}>Accent Color Spectrum</Text>
      <View
        onLayout={e => barWidthRef.current = e.nativeEvent.layout.width}
        onTouchStart={handleBarTouch}
        onTouchMove={handleBarTouch}
        style={{
          height: 24,
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: borderTheme,
          position: 'relative',
        }}
      >
        <View style={{ flexDirection: 'row', width: '100%', height: '100%' }} pointerEvents="none">
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: hslToHex(i * 30, 95, 60),
              }}
            />
          ))}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 1,
            left: `${(hueVal / 360) * 94}%`,
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: '#FFF',
            borderWidth: 3,
            borderColor: hslToHex(hueVal, 95, 60),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.5,
            shadowRadius: 2,
            elevation: 4,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: secondaryText }}>Red</Text>
        <Text style={{ fontSize: 9, color: secondaryText }}>Green</Text>
        <Text style={{ fontSize: 9, color: secondaryText }}>Blue</Text>
        <Text style={{ fontSize: 9, color: secondaryText }}>Pink</Text>
      </View>
      <TouchableOpacity
        style={[styles.resetAccentBtn, { borderColor: accent, marginTop: 12 }]}
        onPress={() => {
          setHueVal(250);
          onUpdateAccentColor(null);
        }}
      >
        <Text style={[styles.resetAccentBtnText, { color: accent }]}>Reset to Default Indigo</Text>
      </TouchableOpacity>
    </View>
  );
};

interface SettingsScreenProps {
  theme: ThemeName;
  onUpdateTheme: (theme: ThemeName) => void;
  customAccentColor: string | null;
  onUpdateAccentColor: (color: string | null) => void;
  wallpaperUri: string | null;
  onUpdateWallpaperUri: (uri: string | null) => void;
  wallpaperOpacity: number;
  onUpdateWallpaperOpacity: (opacity: number) => void;
  isActive: boolean;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  theme,
  onUpdateTheme,
  customAccentColor,
  onUpdateAccentColor,
  wallpaperUri,
  onUpdateWallpaperUri,
  wallpaperOpacity,
  onUpdateWallpaperOpacity,
  isActive,
}) => {
  const [hueVal, setHueVal] = useState(250);
  const stylesObj = getThemeStyles(theme, !!wallpaperUri);

  const primaryText = stylesObj.primaryText;
  const secondaryText = stylesObj.secondaryText;
  const borderTheme = stylesObj.borderColor;
  const accent = customAccentColor || '#6366F1';
  const cardBg = stylesObj.cardBgSolid;

  const handlePickWallpaper = async () => {
    if (!MediaPicker) {
      Alert.alert('Not Supported', 'MediaPicker native module is not available.');
      return;
    }
    try {
      const selectedUri = await MediaPicker.pickMedia();
      if (selectedUri) {
        onUpdateWallpaperUri(selectedUri);
        Alert.alert('Success', 'Custom background wallpaper loaded successfully!');
      }
    } catch (e: any) {
      if (e.message !== 'Selection canceled' && e.code !== 'PICKER_CANCELED') {
        Alert.alert('Error', e.message || 'Failed to select custom wallpaper.');
      }
    }
  };

  const handleClearWallpaper = () => {
    onUpdateWallpaperUri(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: 'transparent' }]}>
      <StatusBar
        barStyle={stylesObj.statusBarStyle}
        backgroundColor={stylesObj.statusBarBg}
      />

      <View style={[styles.header, { backgroundColor: stylesObj.headerBg, borderBottomColor: borderTheme }]}>
        <Text style={[styles.headerTitle, { color: primaryText }]}>Personalization & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Workspace Theme Row */}

        <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: borderTheme }]}>
          <Text style={[styles.panelCardTitle, { color: primaryText }]}>Workspace Theme</Text>
          <Text style={[styles.panelCardDesc, { color: secondaryText }]}>Select a master layout color setting for your color-grading space.</Text>
          
          <View style={styles.themeSelectorRow}>
            {([
              { key: 'obsidian', label: 'Obsidian' },
              { key: 'editorial', label: 'Editorial' },
              { key: 'light', label: 'Light' }
            ] as const).map(t => {
              const isSelected = theme === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[
                    styles.themeTabBtn,
                    { borderColor: borderTheme, backgroundColor: stylesObj.primaryBg },
                    isSelected && { borderColor: accent, backgroundColor: accent + '1A' }
                  ]}
                  onPress={() => onUpdateTheme(t.key)}
                >
                  <Text style={[styles.themeTabBtnText, { color: secondaryText }, isSelected && { color: accent, fontWeight: 'bold' }]}>
                    {t.label}
                  </Text>
                  {isSelected && <View style={[styles.activeDot, { backgroundColor: accent }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity 
  style={[styles.panelCard, { backgroundColor: cardBg, borderColor: borderTheme, marginTop: 12 }]}
  onPress={() => Alert.alert('Remove Ads', 'Purchase triggered!')}
>
  <Text style={[styles.panelCardTitle, { color: primaryText }]}>Remove Ads</Text>
  <Text style={[styles.panelCardDesc, { color: secondaryText }]}>Support us and remove all advertisements.</Text>
</TouchableOpacity>

        {/* Accent Color Spectrum */}
        <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: borderTheme }]}>
          <Text style={[styles.panelCardTitle, { color: primaryText }]}>Interface Highlights</Text>
          <Text style={[styles.panelCardDesc, { color: secondaryText }]}>Drag the spectrum bar below to personalize highlighting notes, sliders, and button tabs.</Text>
          <SpectrumPicker
            hueVal={hueVal}
            setHueVal={setHueVal}
            onUpdateAccentColor={onUpdateAccentColor}
            accent={accent}
            secondaryText={secondaryText}
            borderTheme={borderTheme}
          />
        </View>

        {/* Custom Image Wallpaper */}
        <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: borderTheme }]}>
          <Text style={[styles.panelCardTitle, { color: primaryText }]}>Custom Background Image</Text>
          <Text style={[styles.panelCardDesc, { color: secondaryText }]}>
            Import a custom graphic wallpaper or sky photo to show behind frosted glassmorphic UI controls.
          </Text>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: primaryText }]}>Enable Backdrop Wallpaper</Text>
            <Switch
              value={!!wallpaperUri}
              onValueChange={(val) => {
                if (val) {
                  handlePickWallpaper();
                } else {
                  handleClearWallpaper();
                }
              }}
              trackColor={{ false: '#334155', true: accent }}
              thumbColor={Platform.OS === 'android' ? (!!wallpaperUri ? '#FFFFFF' : '#94A3B8') : undefined}
            />
          </View>

          {wallpaperUri ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.wallpaperStatusText, { color: accent }]} numberOfLines={1}>
                Active Wallpaper: {wallpaperUri.split('/').pop() || 'Selected Image'}
              </Text>
              
              <ToolSlider
                label="Wallpaper Opacity / Visibility"
                value={wallpaperOpacity}
                min={0.05}
                max={0.7}
                step={0.05}
                accentColor={accent}
                onValueChange={(val) => onUpdateWallpaperOpacity(val)}
                formatValue={(v) => `${Math.round(v * 100)}%`}
              />

              <TouchableOpacity
                style={[styles.clearWallpaperBtn, { borderColor: '#EF4444' }]}
                onPress={handleClearWallpaper}
              >
                <Text style={styles.clearWallpaperText}>Remove Wallpaper</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.importBtn, { backgroundColor: accent }]}
              onPress={handlePickWallpaper}
            >
              <Text style={styles.importBtnText}>Select Image From Gallery</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* About App Info */}
        <View style={[styles.panelCard, { backgroundColor: cardBg, borderColor: borderTheme, marginBottom: 32 }]}>
          <Text style={[styles.panelCardTitle, { color: primaryText }]}>LUT LAB Suite</Text>
          <Text style={[styles.panelCardDesc, { color: secondaryText, lineHeight: 18 }]}>
            Version 1.2.0 (Stable Release)
            {"\n"}Designed with high-performance real-time GPU grading algorithms. Supports offscreen video compilation, curves mapping, and community preset look exchanges.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1.5,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  panelCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  panelCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  panelCardDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  themeTabBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  themeTabBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  subSectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  resetAccentBtn: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetAccentBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  wallpaperStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  importBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  importBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: 'bold',
  },
  clearWallpaperBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  clearWallpaperText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
