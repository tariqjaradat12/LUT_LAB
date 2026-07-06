export interface AppTheme {
  primaryBg: string;
  surfaceBg: string;
  cardBg: string;
  borderColor: string;
  primaryText: string;
  secondaryText: string;
  statusBarBg: string;
  statusBarStyle: 'light-content' | 'dark-content';
  accentGlow: string;
}

export type ThemeName = 'obsidian' | 'editorial' | 'light';

export const THEMES: Record<ThemeName, AppTheme> = {
  obsidian: {
    primaryBg: '#080C14',
    surfaceBg: '#0E1624',
    cardBg: '#152033',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    primaryText: '#F8FAFC',
    secondaryText: '#64748B',
    statusBarBg: '#080C14',
    statusBarStyle: 'light-content',
    accentGlow: 'rgba(99, 102, 241, 0.15)',
  },
  editorial: {
    primaryBg: '#141312',
    surfaceBg: '#1C1B1A',
    cardBg: '#2D2B28',
    borderColor: 'rgba(217, 119, 6, 0.08)',
    primaryText: '#F4F3F2',
    secondaryText: '#8E8A85',
    statusBarBg: '#141312',
    statusBarStyle: 'light-content',
    accentGlow: 'rgba(217, 119, 6, 0.12)',
  },
  light: {
    primaryBg: '#F8FAFC',
    surfaceBg: '#FFFFFF',
    cardBg: '#F1F5F9',
    borderColor: '#E2E8F0',
    primaryText: '#0F172A',
    secondaryText: '#475569',
    statusBarBg: '#FFFFFF',
    statusBarStyle: 'dark-content',
    accentGlow: 'rgba(99, 102, 241, 0.05)',
  },
};

/**
 * Returns the theme style mapping, adjusting background colors to be semi-transparent
 * if a custom wallpaper background is currently active.
 */
export function getThemeStyles(themeName: ThemeName, hasWallpaper: boolean) {
  const base = THEMES[themeName] || THEMES.obsidian;
  if (!hasWallpaper) {
    return {
      ...base,
      containerBg: base.primaryBg,
      surfaceBgSolid: base.surfaceBg,
      cardBgSolid: base.cardBg,
      headerBg: base.surfaceBg,
      tabBarBg: base.surfaceBg,
    };
  }

  // If wallpaper is active, apply glassmorphic opacity configurations
  const isDark = themeName !== 'light';
  return {
    ...base,
    containerBg: 'transparent',
    surfaceBgSolid: isDark ? 'rgba(14, 22, 36, 0.75)' : 'rgba(255, 255, 255, 0.8)',
    cardBgSolid: isDark ? 'rgba(21, 32, 51, 0.85)' : 'rgba(241, 245, 249, 0.85)',
    headerBg: isDark ? 'rgba(14, 22, 36, 0.75)' : 'rgba(255, 255, 255, 0.8)',
    tabBarBg: isDark ? 'rgba(14, 22, 36, 0.75)' : 'rgba(255, 255, 255, 0.8)',
  };
}
