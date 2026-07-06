/**
 * CategoryTabBar — Horizontal scrolling pill tab bar for editing tool categories.
 */
import React from 'react';
import { ScrollView, TouchableOpacity, Text, View, StyleSheet } from 'react-native';

export type ToolCategory =
  | 'light'
  | 'color'
  | 'curves'
  | 'hsl'
  | 'wheels'
  | 'detail'
  | 'geometry'
  | 'effects'
  | 'overlays';

interface CategoryTabBarProps {
  active: ToolCategory;
  onSelect: (cat: ToolCategory) => void;
  onSharePress?: () => void;
  shareActive?: boolean;
  customAccentColor?: string;
  theme?: 'light' | 'dark';
}

const TABS: { key: ToolCategory; label: string }[] = [
  { key: 'light',    label: 'Light' },
  { key: 'color',    label: 'Color' },
  { key: 'curves',   label: 'Curves' },
  { key: 'hsl',      label: 'HSL' },
  { key: 'geometry', label: 'Geometry' },
  { key: 'detail',   label: 'Detail' },
  { key: 'effects',  label: 'FX' },
  { key: 'overlays', label: 'Overlays' },
];

const ACCENT: Record<ToolCategory, string> = {
  light:    '#FBBF24',
  color:    '#F472B6',
  curves:   '#34D399',
  hsl:      '#A78BFA',
  wheels:   '#60A5FA',
  geometry: '#10B981',
  detail:   '#94A3B8',
  effects:  '#FB923C',
  overlays: '#38BDF8',
};

export const CategoryTabBar: React.FC<CategoryTabBarProps> = ({ active, onSelect, onSharePress, shareActive, customAccentColor, theme }) => {
  const isDark = theme !== 'light';
  const wrapperBg = isDark ? '#0B0F19' : '#F1F5F9';
  const wrapperBorder = isDark ? '#1E293B' : '#CBD5E1';
  const tabBg = isDark ? '#0F172A' : '#FFFFFF';
  const tabBorder = isDark ? '#1E293B' : '#E2E8F0';
  const textInactive = isDark ? '#64748B' : '#94A3B8';

  return (
    <View style={[styles.wrapper, { backgroundColor: wrapperBg, borderColor: wrapperBorder }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TABS.map(tab => {
          const isActive = tab.key === active;
          const accent = customAccentColor || ACCENT[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                { backgroundColor: tabBg, borderColor: tabBorder },
                isActive && { backgroundColor: accent + '22', borderColor: accent },
              ]}
              onPress={() => onSelect(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabLabel, { color: textInactive }, isActive && { color: accent }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
        {onSharePress && (
          <TouchableOpacity
            style={[
              styles.tab,
              { backgroundColor: tabBg, borderColor: tabBorder },
              shareActive && { backgroundColor: '#10B98122', borderColor: '#10B981' },
            ]}
            onPress={onSharePress}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, { color: textInactive }, shareActive && { color: '#10B981' }]}>
              Share LUT
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

export { ACCENT as CATEGORY_ACCENT };

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
    gap: 5,
  },
  tabLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
