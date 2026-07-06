/**
 * HomeScreen — Original app content extracted from App.tsx.
 * Layout: Fixed video player at top, scrollable LUT controls below.
 */
import React, { useState } from 'react';
import {
  SafeAreaView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, ScrollView,
  Alert, NativeModules, Platform, useWindowDimensions,
} from 'react-native';
import { LogVideoPlayer } from '../components/LogVideoPlayer';
import { ColorGradingEngine, LogFormat } from '../core/engine/ColorGradingEngine';
import { LutEngine } from '../core/engine/LutEngine';
import { ThemeName, getThemeStyles } from '../core/theme';
import { LutState } from '../core/presets/LutPresets';
import { LutPanel } from '../components/LutPanel';

const { MediaPicker } = NativeModules;

interface HomeScreenProps {
  mediaUri: string | null;
  setMediaUri: (uri: string | null) => void;
  logFormat: LogFormat;
  setLogFormat: (f: LogFormat) => void;
  isActive: boolean;
  theme: ThemeName;
  customAccentColor: string;
  wallpaperActive: boolean;
  lutState: LutState;
  onLutStateChange: (patch: Partial<LutState>) => void;
  onAddLutToDeck?: (name: string, params: { activeLutPresetId: string; customLutData?: number[]; customLutSize?: number }) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  mediaUri,
  setMediaUri,
  logFormat,
  setLogFormat,
  isActive,
  theme,
  customAccentColor,
  wallpaperActive,
  lutState,
  onLutStateChange,
  onAddLutToDeck,
}) => {
  const [scrollLocked, setScrollLocked] = useState(false);

  const handleSelectLocalMedia = async () => {
    if (!MediaPicker) {
      Alert.alert('Not Supported', 'MediaPicker native module is not available.');
      return;
    }
    try {
      const selectedUri = await MediaPicker.pickMedia();
      setMediaUri(selectedUri);
    } catch (e: any) {
      if (e.message !== 'Selection canceled' && e.code !== 'PICKER_CANCELED') {
        Alert.alert('Error', e.message || 'Failed to select media.');
      }
    }
  };

  const { width, height } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const stylesObj = getThemeStyles(theme, wallpaperActive);
  const isDark = theme !== 'light';

  const primaryText = stylesObj.primaryText;
  const secondaryText = stylesObj.secondaryText;
  const bgTheme = stylesObj.containerBg;
  const cardTheme = stylesObj.surfaceBgSolid;
  const borderTheme = stylesObj.borderColor;

  const lutParams = LutEngine.getLutParams(
    lutState.activeLutPresetId,
    lutState.customLutData,
    lutState.customLutSize,
    lutState.importedLuts
  );

  // Player height: 45% of screen height on phones, 360 on tablets
  const playerHeight = isLargeScreen ? 360 : Math.round(height * 0.44);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgTheme }]}>
      <StatusBar
        barStyle={stylesObj.statusBarStyle}
        backgroundColor={stylesObj.statusBarBg}
      />

      {/* ── FIXED TOP: branding + video player ── */}
      <View style={[styles.playerSection, { backgroundColor: isDark ? '#0A0C10' : '#F1F5F9' }]}>
        {/* Mini header */}
        <View style={styles.miniHeader}>
          <Text style={[styles.miniTitle, { color: primaryText }]}>LUT LAB</Text>
          <Text style={[styles.miniSubtitle, { color: secondaryText }]}>GPU Color Grading Suite</Text>
        </View>

        {/* Player or placeholder */}
        {mediaUri && isActive ? (
          <LogVideoPlayer
            videoUrl={mediaUri}
            logFormat={logFormat}
            exposure={0.0}
            contrast={1.0}
            saturation={1.0}
            gamma={1.0}
            lutData={lutParams.lutData}
            lutSize={lutParams.lutSize}
            lutIntensity={lutState.lutIntensity}
            lutColorOffset={lutState.lutColorOffset}
            lutToneOffset={lutState.lutToneOffset}
            style={[styles.player, { height: playerHeight }]}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.placeholderPlayer,
              {
                height: playerHeight,
                backgroundColor: isDark ? 'rgba(15,23,42,0.6)' : 'rgba(226,232,240,0.6)',
                borderColor: borderTheme,
              },
            ]}
            onPress={handleSelectLocalMedia}
            activeOpacity={0.8}
          >
            <Text style={[styles.placeholderIcon, { color: customAccentColor }]}>＋</Text>
            <Text style={[styles.placeholderPlayerText, { color: primaryText }]}>
              {mediaUri ? 'Media Paused' : 'Tap to Import Photo or Video'}
            </Text>
            <Text style={[styles.placeholderPlayerSubtext, { color: secondaryText }]}>
              {mediaUri
                ? 'Switch to Home tab to resume GPU preview.'
                : 'Pick from your gallery to start real-time color grading.'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── SCROLLABLE BOTTOM: controls ── */}
      <ScrollView
        style={styles.controlsScroll}
        contentContainerStyle={styles.controlsContent}
        scrollEnabled={!scrollLocked}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Import button */}
        <TouchableOpacity
          style={[styles.importBtn, { backgroundColor: customAccentColor }]}
          onPress={handleSelectLocalMedia}
          activeOpacity={0.8}
        >
          <Text style={styles.importBtnText}>Import from Phone Gallery</Text>
        </TouchableOpacity>

        {/* Log Format selector */}
        <View style={[styles.sectionCard, { backgroundColor: cardTheme, borderColor: borderTheme }]}>
          <Text style={[styles.sectionLabel, { color: secondaryText }]}>Log Format</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.formatRow,
              { backgroundColor: isDark ? 'rgba(8,12,20,0.6)' : 'rgba(241,245,249,0.6)', borderColor: borderTheme },
            ]}
          >
            {(['slog3', 'clog', 'dlog', 'arrilogc3', 'arrilogc4', 'redlog3g10', 'flog', 'flog2', 'vlog', 'hlg', 'rec709'] as LogFormat[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.formatTab, logFormat === f && { backgroundColor: customAccentColor }]}
                onPress={() => setLogFormat(f)}
              >
                <Text style={[
                  styles.formatTabText,
                  { color: isDark ? '#64748B' : '#94A3B8' },
                  logFormat === f && { color: '#000000', fontWeight: 'bold' },
                ]}>
                  {f.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* LUT Looks panel */}
        <View style={[styles.sectionCard, { backgroundColor: cardTheme, borderColor: borderTheme }]}>
          <Text style={[styles.sectionTitle, { color: primaryText }]}>LUT Looks</Text>
          <Text style={[styles.sectionDesc, { color: secondaryText }]}>
            Apply cinematic color grades instantly. Import .cube files or pick from built-in and procedural presets.
          </Text>
          <LutPanel
            lutState={lutState}
            onLutStateChange={onLutStateChange}
            accentColor={customAccentColor}
            primaryText={primaryText}
            secondaryText={secondaryText}
            cardTheme={cardTheme}
            borderTheme={borderTheme}
            isDark={isDark}
            onAddToDeck={onAddLutToDeck}
            onScrollLockChange={setScrollLocked}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Fixed player section ──
  playerSection: {
    width: '100%',
    paddingBottom: 4,
  },
  miniHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  miniTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  miniSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  player: {
    width: '100%',
    overflow: 'hidden',
  },
  placeholderPlayer: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  placeholderIcon: {
    fontSize: 40,
    fontWeight: '200',
    marginBottom: 8,
  },
  placeholderPlayerText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  placeholderPlayerSubtext: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 24,
  },

  // ── Scrollable controls section ──
  controlsScroll: {
    flex: 1,
  },
  controlsContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  importBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  importBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 15,
  },
  sectionCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  formatRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  formatTab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  formatTabText: {
    fontSize: 10,
    fontWeight: 'bold',
  },

  // legacy unused (kept for safety)
  button: { backgroundColor: '#6366F1', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});
