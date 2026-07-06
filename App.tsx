/**
 * App.tsx — Root entry point.
 * Bottom tab navigator: Home | Edit Studio | Community | Settings
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform, Alert, NativeModules, ImageBackground, LogBox,
} from 'react-native';

LogBox.ignoreAllLogs();
// CameraScreen has been removed

import { HomeScreen } from './src/screens/HomeScreen';
import { EditStudio } from './src/screens/EditStudio';
import { CommunityScreen, CommunityPost } from './src/screens/CommunityScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { EditParams, DEFAULT_EDIT_PARAMS } from './src/core/engine/EditingEngine';
import { LogFormat } from './src/core/engine/ColorGradingEngine';
import { ThemeName, getThemeStyles } from './src/core/theme';
import { LutState, DEFAULT_LUT_STATE, ImportedLut } from './src/core/presets/LutPresets';

type Tab = 'home' | 'studio' | 'community' | 'settings';

const TAB_CONFIG: { key: Tab; label: string }[] = [
  { key: 'home',      label: 'Home' },
  { key: 'studio',    label: 'Studio' },
  { key: 'community', label: 'Community' },
  { key: 'settings',  label: 'Settings' },
];

const getTabStyle = (isActive: boolean) => isActive 
  ? { flex: 1 } 
  : { position: 'absolute' as const, left: -10000, width: 0, height: 0, overflow: 'hidden' as const };

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [registeredAuthorName, setRegisteredAuthorName] = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [logFormat, setLogFormat] = useState<LogFormat>('rec709');
  
  // Theme, Accent, and Wallpaper customization
  const [theme, setTheme] = useState<ThemeName>('obsidian');
  const [customAccentColor, setCustomAccentColor] = useState<string | null>(null);
  const [wallpaperUri, setWallpaperUri] = useState<string | null>(null);
  const [wallpaperOpacity, setWallpaperOpacity] = useState<number>(0.25);
  const [lutState, setLutState] = useState<LutState>(DEFAULT_LUT_STATE);
  
  // Shuffled community presets deck state
  const [communityDeck, setCommunityDeck] = useState<Array<{ name: string; params: Partial<EditParams>; color?: string }>>([]);
  const [params, setParams] = useState<EditParams>(DEFAULT_EDIT_PARAMS);
  const [isLutStateLoaded, setIsLutStateLoaded] = useState(false);

  // Shared state for the Community Tab — All presets are free ($0)
  const [posts, setPosts] = useState<CommunityPost[]>([
    {
      id: 'post_1',
      author: '@neon_tokyo',
      avatar: 'NT',
      title: 'Shibuya Rain Trails',
      description: 'Vibrant neon shades with dynamic right-hand long exposure stretch trails. Perfect for nighttime urban shots.',
      price: 0,
      likes: 412,
      isLiked: false,
      isBought: true,
      lutName: 'Cyberpunk Neon',
      bgColors: ['#FF00FF', '#0F172A', '#FF0088', '#00FFFF'],
      editParams: {
        exposure: 0.3,
        contrast: 25,
        saturation: 35,
        vibrance: 15,
        temperature: -25,
        longExposureAmount: 60,
        longExposureDirection: 80,
        longExposureThreshold: 0.3,
        activeLutPresetId: 'procedural_10',
      },
    },
    {
      id: 'post_2',
      author: '@vintage_dreamer',
      avatar: 'VD',
      title: 'Faded Golden Hour',
      description: 'Warm sepia tones blended with soft bokeh and vignette. Brings out a nostalgically quiet mood.',
      price: 0,
      likes: 850,
      isLiked: false,
      isBought: true,
      lutName: 'Warm Vintage',
      bgColors: ['#FF8844', '#0F172A', '#D97706', '#FBBF24'],
      editParams: {
        exposure: 0.1,
        contrast: -10,
        saturation: -15,
        temperature: 30,
        vignetteStrength: 45,
        vignetteRadius: 0.65,
        vignetteSoftness: 0.7,
        softness: 25,
        activeLutPresetId: 'procedural_7',
      },
    },
    {
      id: 'post_3',
      author: '@grain_master',
      avatar: 'GM',
      title: 'Noir Film Portrait',
      description: 'High contrast black and white with thick film grain and subtle spotlight halation.',
      price: 0,
      likes: 1240,
      isLiked: false,
      isBought: true,
      lutName: 'Classic Noir',
      bgColors: ['#CCCCCC', '#0F172A', '#444444', '#FFFFFF'],
      editParams: {
        bwEnabled: true,
        contrast: 50,
        highlights: -20,
        shadows: 15,
        grainAmount: 75,
        grainSize: 4.5,
        grainRoughness: 0.7,
        activeLutPresetId: 'procedural_8',
      },
    },
  ]);

  // Transferred preset from community feed to editor
  const [externalPreset, setExternalPreset] = useState<{
    params: Partial<EditParams>;
    name: string;
  } | null>(null);

  // Settings & Session Restoration check on launch
  useEffect(() => {
    const checkState = async () => {
      const { LutShare } = NativeModules;
      if (!LutShare) return;

      // Load app settings (theme and custom color)
      try {
        const settingsStr = await LutShare.loadState('app_settings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          if (settings.theme) {
            // Map legacy theme values compatibility
            const mappedTheme = settings.theme === 'dark' ? 'obsidian' : settings.theme;
            setTheme(mappedTheme);
          }
          if (settings.customAccentColor !== undefined) setCustomAccentColor(settings.customAccentColor);
          if (settings.wallpaperUri !== undefined) setWallpaperUri(settings.wallpaperUri);
          if (settings.wallpaperOpacity !== undefined) setWallpaperOpacity(settings.wallpaperOpacity);
        }
      } catch (e) {
        console.log('Failed to load settings:', e);
      }

      // Load registered username
      try {
        const username = await LutShare.loadState('registered_username');
        if (username) {
          setRegisteredAuthorName(username);
        }
      } catch (e) {
        console.log('Failed to load registered username:', e);
      }

      // Load imported LUTs
      try {
        const importedStr = await LutShare.loadState('imported_luts');
        if (importedStr) {
          const imported = JSON.parse(importedStr);
          setLutState(prev => ({ ...prev, importedLuts: imported }));
        }
      } catch (e) {
        console.log('Failed to load imported LUTs:', e);
      }
      setIsLutStateLoaded(true);

      // Load liked post IDs
      try {
        const likedStr = await LutShare.loadState('liked_post_ids');
        if (likedStr) {
          const likedIds = JSON.parse(likedStr);
          setPosts(prev =>
            prev.map(p => {
              if (likedIds.includes(p.id)) {
                return {
                  ...p,
                  isLiked: true,
                  likes: p.likes + 1,
                };
              }
              return p;
            })
          );
        }
      } catch (e) {
        console.log('Failed to load liked posts:', e);
      }

      // Load LUTs shared from this device
      try {
        const sharedPostsStr = await LutShare.loadState('community_user_posts');
        if (sharedPostsStr) {
          const sharedPosts: CommunityPost[] = JSON.parse(sharedPostsStr);
          setPosts(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            return [...sharedPosts.filter(p => !existingIds.has(p.id)), ...prev];
          });
        }
      } catch (e) {
        console.log('Failed to load shared community LUTs:', e);
      }

      // Check editor session state
      try {
        const savedStr = await LutShare.loadState('saved_editor_state');
        if (savedStr) {
          const savedData = JSON.parse(savedStr);
          if (savedData && savedData.mediaUri) {
            Alert.alert(
              'Carry on?',
              'Keep the edits for the photo/video and carry on?',
              [
                {
                  text: 'No',
                  style: 'cancel',
                  onPress: async () => {
                    await LutShare.clearState('saved_editor_state');
                    setMediaUri(null);
                    setActiveTab('home');
                    const { MediaPicker } = NativeModules;
                    if (MediaPicker) {
                      try {
                        const selectedUri = await MediaPicker.pickMedia();
                        if (selectedUri) {
                          setMediaUri(selectedUri);
                        }
                      } catch (err) {
                        // Picker cancelled
                      }
                    }
                  }
                },
                {
                  text: 'Yes',
                  onPress: () => {
                    setMediaUri(savedData.mediaUri);
                    setLogFormat(savedData.logFormat || 'rec709');
                    if (savedData.params) {
                      setParams(savedData.params);
                      setLutState(prev => ({
                        ...prev,
                        activeLutPresetId: savedData.params.activeLutPresetId ?? null,
                        lutIntensity: savedData.params.lutIntensity ?? 100,
                        lutColorOffset: savedData.params.lutColorOffset ?? 0,
                        lutToneOffset: savedData.params.lutToneOffset ?? 0,
                        customLutData: savedData.params.customLutData ?? null,
                        customLutSize: savedData.params.customLutSize ?? 33,
                        importedLuts: savedData.params.importedLuts ?? [],
                      }));
                    }
                    setActiveTab('home');
                  }
                }
              ]
            );
          }
        }
      } catch (e) {
        console.log('Failed to check editor state:', e);
      }
    };

    checkState();
  }, []);

  const handleUpdateTheme = (newTheme: ThemeName) => {
    setTheme(newTheme);
    NativeModules.LutShare.saveState('app_settings', JSON.stringify({
      theme: newTheme,
      customAccentColor,
      wallpaperUri,
      wallpaperOpacity,
    }));
  };

  const handleUpdateAccentColor = (newAccent: string | null) => {
    setCustomAccentColor(newAccent);
    NativeModules.LutShare.saveState('app_settings', JSON.stringify({
      theme,
      customAccentColor: newAccent,
      wallpaperUri,
      wallpaperOpacity,
    }));
  };

  const handleUpdateWallpaperUri = (newUri: string | null) => {
    setWallpaperUri(newUri);
    NativeModules.LutShare.saveState('app_settings', JSON.stringify({
      theme,
      customAccentColor,
      wallpaperUri: newUri,
      wallpaperOpacity,
    }));
  };

  const handleUpdateWallpaperOpacity = (newOpacity: number) => {
    setWallpaperOpacity(newOpacity);
    NativeModules.LutShare.saveState('app_settings', JSON.stringify({
      theme,
      customAccentColor,
      wallpaperUri,
      wallpaperOpacity: newOpacity,
    }));
  };

  const handleLutStateChange = (patch: Partial<LutState>) => {
    setLutState(prev => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (isLutStateLoaded) {
      NativeModules.LutShare.saveState('imported_luts', JSON.stringify(lutState.importedLuts))
        .catch((err: any) => console.log('Failed to save imported LUTs:', err));
    }
  }, [lutState.importedLuts, isLutStateLoaded]);

  useEffect(() => {
    if (mediaUri) {
      const merged = {
        ...params,
        activeLutPresetId: lutState.activeLutPresetId,
        lutIntensity: lutState.lutIntensity,
        lutColorOffset: lutState.lutColorOffset,
        lutToneOffset: lutState.lutToneOffset,
        customLutData: lutState.customLutData,
        customLutSize: lutState.customLutSize,
        importedLuts: lutState.importedLuts,
      };
      const stateToSave = {
        mediaUri,
        logFormat,
        params: merged,
      };
      NativeModules.LutShare.saveState('saved_editor_state', JSON.stringify(stateToSave))
        .catch((err: any) => console.log('Saved editor state error:', err));
    }
  }, [mediaUri, logFormat, params, lutState]);

  const handleLikePost = (id: string) => {
    setPosts(prev => {
      const updated = prev.map(p => {
        if (p.id === id) {
          return {
            ...p,
            isLiked: !p.isLiked,
            likes: p.isLiked ? p.likes - 1 : p.likes + 1,
          };
        }
        return p;
      });
      const likedIds = updated.filter(p => p.isLiked).map(p => p.id);
      NativeModules.LutShare.saveState('liked_post_ids', JSON.stringify(likedIds)).catch(() => {});
      return updated;
    });
  };

  const handleExtractPreset = (p: Partial<EditParams>, lutName: string) => {
    setCommunityDeck(prev => {
      if (prev.some(item => item.name === lutName)) return prev;
      return [...prev, { name: lutName, params: p }];
    });
    setParams(prev => ({ ...prev, ...p }));
    setLutState(prev => ({
      ...prev,
      activeLutPresetId: p.activeLutPresetId ?? prev.activeLutPresetId,
      lutIntensity: p.lutIntensity ?? prev.lutIntensity,
      lutColorOffset: p.lutColorOffset ?? prev.lutColorOffset,
      lutToneOffset: p.lutToneOffset ?? prev.lutToneOffset,
      customLutData: p.customLutData ?? prev.customLutData,
      customLutSize: p.customLutSize ?? prev.customLutSize,
    }));
    setExternalPreset({ params: p, name: lutName });
    Alert.alert('LUT Applied', `"${lutName}" is now active on Home. Open Studio for the full community grade.`);
  };

  const handleAddLutToDeck = (name: string, params: Partial<EditParams>) => {
    setCommunityDeck(prev => {
      if (prev.some(item => item.name === name)) return prev;
      return [...prev, { name, params }];
    });
  };

  const handleShareToCommunity = (title: string, authorName: string, params: EditParams) => {
    const formattedTitle = title.trim();
    if (!formattedTitle) {
      Alert.alert('Validation Failed', 'Please input a title for your preset.');
      return;
    }
    if (!authorName.trim()) {
      Alert.alert('Validation Failed', 'Please input your name to publish.');
      return;
    }

    const formattedAuthor = authorName.trim().startsWith('@') ? authorName.trim() : `@${authorName.trim()}`;
    const authorLower = formattedAuthor.toLowerCase();

    // Check if preset title already exists in gallery
    const titleExists = posts.some(p => p.title.toLowerCase() === formattedTitle.toLowerCase());
    if (titleExists) {
      Alert.alert('Duplicate Title', `A preset named "${formattedTitle}" already exists in the Community Gallery. Please choose a unique title.`);
      return;
    }

    // Check username hijacking prevention
    if (registeredAuthorName) {
      if (registeredAuthorName.toLowerCase() !== authorLower) {
        Alert.alert(
          'Username Taken / Locked',
          `You have already registered the username "${registeredAuthorName}" on this device. You must publish using this name.`
        );
        return;
      }
    } else {
      // First-time publish: check if this author is already used in pre-existing posts (taken by other creators)
      const nameTaken = posts.some(p => p.author.toLowerCase() === authorLower);
      if (nameTaken) {
        Alert.alert(
          'Username Taken',
          `The username "${formattedAuthor}" is already in use by another creator. Please choose a different name.`
        );
        return;
      }
      // Set & save registered username
      setRegisteredAuthorName(formattedAuthor);
      NativeModules.LutShare.saveState('registered_username', formattedAuthor).catch(() => {});
    }

    const activeAccent = customAccentColor || '#6366F1';
    const initialLetter = formattedAuthor.substring(1, 2).toUpperCase() || 'U';
    const newPost: CommunityPost = {
      id: `post_user_${Date.now()}`,
      author: formattedAuthor,
      avatar: initialLetter,
      title: formattedTitle,
      description: `Custom artistic look created using LUT LAB adjustments. Features custom curves and grading layers.`,
      price: 0, // All posts published are free
      likes: 0,
      isLiked: false,
      isBought: true, // Maker owns their own post
      lutName: formattedTitle,
      bgColors: [activeAccent, '#0F172A', '#4F46E5', '#10B981'],
      editParams: { ...params },
    };

    setPosts(prev => {
      const updated = [newPost, ...prev];
      const userPosts = updated.filter(post => post.id.startsWith('post_user_'));
      NativeModules.LutShare.saveState('community_user_posts', JSON.stringify(userPosts)).catch(() => {});
      return updated;
    });
    Alert.alert(
      'Published!',
      `Successfully published "${formattedTitle}" to the Community Gallery feed!`,
      [{ text: 'Ok', onPress: () => setActiveTab('community') }]
    );
  };

  const stylesObj = getThemeStyles(theme, !!wallpaperUri);
  const activeAccent = customAccentColor || '#6366F1';

  const renderContent = () => (
    <View style={[styles.root, { backgroundColor: stylesObj.containerBg }]}>
      {/* Screen content */}
      <View style={styles.screen}>
        {/* Camera tab has been removed */}
        <View style={getTabStyle(activeTab === 'home')}>
          <HomeScreen
            mediaUri={mediaUri}
            setMediaUri={setMediaUri}
            logFormat={logFormat}
            setLogFormat={setLogFormat}
            isActive={activeTab === 'home'}
            theme={theme}
            customAccentColor={activeAccent}
            wallpaperActive={!!wallpaperUri}
            lutState={lutState}
            onLutStateChange={handleLutStateChange}
            onAddLutToDeck={handleAddLutToDeck}
          />
        </View>
        <View style={getTabStyle(activeTab === 'studio')}>
          <EditStudio
            mediaUri={mediaUri}
            logFormat={logFormat}
            externalPreset={externalPreset}
            onClearExternalPreset={() => setExternalPreset(null)}
            onShareToCommunity={handleShareToCommunity}
            isActive={activeTab === 'studio'}
            theme={theme}
            customAccentColor={activeAccent}
            communityDeck={communityDeck}
            onAddLutToDeck={handleAddLutToDeck}
            wallpaperActive={!!wallpaperUri}
            lutState={lutState}
            onLutStateChange={handleLutStateChange}
            params={params}
            setParams={setParams}
          />
        </View>
        <View style={getTabStyle(activeTab === 'community')}>
          <CommunityScreen
            posts={posts}
            onLikePost={handleLikePost}
            onExtractPreset={handleExtractPreset}
            theme={theme}
            customAccentColor={activeAccent}
            wallpaperActive={!!wallpaperUri}
          />
        </View>
        <View style={getTabStyle(activeTab === 'settings')}>
          <SettingsScreen
            theme={theme}
            onUpdateTheme={handleUpdateTheme}
            customAccentColor={customAccentColor}
            onUpdateAccentColor={handleUpdateAccentColor}
            wallpaperUri={wallpaperUri}
            onUpdateWallpaperUri={handleUpdateWallpaperUri}
            wallpaperOpacity={wallpaperOpacity}
            onUpdateWallpaperOpacity={handleUpdateWallpaperOpacity}
            isActive={activeTab === 'settings'}
          />
        </View>
      </View>

      {/* Bottom tab bar */}
      <View style={[
        styles.tabBar,
        {
          backgroundColor: stylesObj.tabBarBg,
          borderTopColor: stylesObj.borderColor,
        }
      ]}>
        {TAB_CONFIG.map(tab => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                console.log('Tab pressed: ' + tab.key);
                setActiveTab(tab.key);
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.tabLabel,
                { color: stylesObj.secondaryText },
                active && { color: activeAccent }
              ]}>
                {tab.label}
              </Text>
              {active && <View style={[styles.activeIndicator, { backgroundColor: activeAccent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  if (wallpaperUri) {
    return (
      <ImageBackground
        source={{ uri: wallpaperUri }}
        style={{ flex: 1 }}
        imageStyle={{ opacity: wallpaperOpacity }}
        resizeMode="cover"
      >
        {renderContent()}
      </ImageBackground>
    );
  }

  return renderContent();
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
});
