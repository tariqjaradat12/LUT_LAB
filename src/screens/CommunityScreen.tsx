import React, { useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
  Platform, StatusBar
} from 'react-native';
import { EditParams } from '../core/engine/EditingEngine';
import { ThemeName, getThemeStyles } from '../core/theme';

export interface CommunityPost {
  id: string;
  author: string;
  avatar: string;
  title: string;
  description: string;
  price: number; // 0 is Free
  likes: number;
  isLiked: boolean;
  isBought: boolean;
  lutName: string;
  bgColors: string[]; // For visual swatch representation
  editParams: Partial<EditParams>;
}

interface CommunityScreenProps {
  posts: CommunityPost[];
  onLikePost: (id: string) => void;
  onExtractPreset: (params: Partial<EditParams>, lutName: string) => void;
  theme: ThemeName;
  customAccentColor: string;
  wallpaperActive: boolean;
}

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  posts,
  onLikePost,
  onExtractPreset,
  theme,
  customAccentColor,
  wallpaperActive,
}) => {
  const stylesObj = getThemeStyles(theme, wallpaperActive);
  const isDark = theme !== 'light';
  
  const primaryText = stylesObj.primaryText;
  const secondaryText = stylesObj.secondaryText;
  const bgTheme = stylesObj.containerBg;
  const cardTheme = stylesObj.surfaceBgSolid;
  const borderTheme = stylesObj.borderColor;
  const accent = customAccentColor || '#6366F1';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bgTheme }]}>
      <StatusBar
        barStyle={stylesObj.statusBarStyle}
        backgroundColor={stylesObj.statusBarBg}
      />
      
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: borderTheme, backgroundColor: stylesObj.headerBg }]}>
        <Text style={[styles.title, { color: primaryText }]}>Community Gallery</Text>
        <Text style={[styles.subtitle, { color: secondaryText }]}>Browse free LUT looks shared by creators — like your favorites and apply them instantly</Text>
      </View>

      {/* Main Posts Feed */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {posts.map(post => {
          return (
            <View key={post.id} style={[styles.postCard, { backgroundColor: cardTheme, borderColor: borderTheme }]}>
              {/* Creator details header */}
              <View style={styles.postHeader}>
                <View style={[styles.avatarCircle, { backgroundColor: isDark ? 'rgba(30,30,36,0.5)' : '#F1F5F9', borderColor: borderTheme }]}>
                  <Text style={[styles.avatarText, { color: primaryText }]}>{post.avatar}</Text>
                </View>
                <View style={styles.headerInfo}>
                  <Text style={[styles.postAuthor, { color: accent }]}>{post.author}</Text>
                  <Text style={[styles.postTitle, { color: primaryText }]}>{post.title}</Text>
                </View>
                <View style={[styles.priceBadge, styles.priceBadgeFree, { borderColor: accent, backgroundColor: accent + '15' }]}>
                  <Text style={[styles.priceText, { color: primaryText }]}>Free</Text>
                </View>
              </View>

              {/* Art thumbnail representation using layered glowing mesh mood orbs */}
              <View style={[styles.visualContainer, { backgroundColor: isDark ? 'rgba(8,12,20,0.4)' : '#F8FAFC', borderColor: borderTheme }]}>
                {/* Glow orbs */}
                <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
                  {post.bgColors.map((col, cIdx) => {
                    const positions = [
                      { top: -25, left: -25, width: 140, height: 140 },
                      { bottom: -35, right: -15, width: 160, height: 160 },
                      { top: -15, right: 15, width: 110, height: 110 },
                      { bottom: -15, left: 35, width: 120, height: 120 },
                    ];
                    const pos = positions[cIdx % positions.length];
                    return (
                      <View
                        key={cIdx}
                        style={{
                          position: 'absolute',
                          backgroundColor: col,
                          borderRadius: 80,
                          opacity: 0.55,
                          ...pos,
                        }}
                      />
                    );
                  })}
                </View>
                
                {/* Swatches Label overlay */}
                <View style={{ position: 'absolute', bottom: 10, left: 10, flexDirection: 'row', gap: 6 }}>
                  <Text style={styles.swatchLabel}>ORIGINAL</Text>
                  <Text style={styles.swatchLabel}>GRADED</Text>
                </View>

                {/* LUT Metadata Label */}
                <View style={[styles.lutNameOverlay, { backgroundColor: isDark ? 'rgba(11,15,25,0.85)' : 'rgba(255,255,255,0.9)', borderColor: borderTheme }]}>
                  <Text style={[styles.lutNameOverlayText, { color: accent }]}>LUT: {post.lutName}</Text>
                </View>
              </View>

              {/* Description */}
              <Text style={[styles.postDesc, { color: secondaryText }]}>{post.description}</Text>

              {/* Parameter Settings Accordion Tag */}
              <View style={styles.settingsPills}>
                {Object.entries(post.editParams).slice(0, 3).map(([key, val]) => (
                  <View key={key} style={[styles.settingPill, { backgroundColor: isDark ? 'rgba(30,41,59,0.5)' : '#F1F5F9', borderColor: borderTheme }]}>
                    <Text style={[styles.settingPillText, { color: primaryText }]}>
                      {key}: {typeof val === 'number' ? (val >= 0 ? '+' : '') + val.toFixed(1) : String(val)}
                    </Text>
                  </View>
                ))}
                {Object.keys(post.editParams).length > 3 && (
                  <View style={[styles.settingPill, { backgroundColor: isDark ? 'rgba(30,41,59,0.5)' : '#F1F5F9', borderColor: borderTheme }]}>
                    <Text style={[styles.settingPillText, { color: primaryText }]}>+{Object.keys(post.editParams).length - 3} adjustments</Text>
                  </View>
                )}
              </View>

              {/* Footer Actions */}
              <View style={[styles.actionsRow, { borderTopColor: borderTheme }]}>
                {/* Like Button */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: isDark ? 'rgba(30,41,59,0.5)' : '#F1F5F9', borderColor: borderTheme },
                    post.isLiked && styles.actionBtnLiked
                  ]}
                  onPress={() => onLikePost(post.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.actionIcon, post.isLiked && styles.actionIconLiked]}>
                    {post.isLiked ? '❤️' : '🤍'}
                  </Text>
                  <Text style={[styles.actionText, { color: secondaryText }, post.isLiked && styles.actionTextLiked]}>
                    {post.isLiked ? 'Liked' : 'Like'} ({post.likes})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.extractBtn, { backgroundColor: accent }]}
                  onPress={() => onExtractPreset(post.editParams, post.lutName)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.extractBtnText, { color: '#000000' }]}>Download & Apply LUT</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#26262B',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 20,
  },
  postCard: {
    backgroundColor: '#18181C',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#26262B',
    gap: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1E24',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3E3E42',
  },
  avatarText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
  },
  postAuthor: {
    fontSize: 13,
    color: '#6366F1',
    fontWeight: 'bold',
  },
  postTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginTop: 1,
  },
  priceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#10B98122',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  priceBadgeFree: {
    backgroundColor: '#6366F122',
    borderColor: '#6366F1',
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  visualContainer: {
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visualGrid: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  visualSwatch: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 8,
  },
  swatchLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  lutNameOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(11,15,25,0.85)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  lutNameOverlayText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: 'bold',
  },
  postDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  settingsPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  settingPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  settingPillText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  actionBtnLiked: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: '#EF4444',
  },
  actionIcon: {
    fontSize: 16,
    color: '#94A3B8',
  },
  actionIconLiked: {
    color: '#F87171',
  },
  actionText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  actionTextLiked: {
    color: '#F87171',
  },
  extractBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 10,
  },
  extractBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Modal checkout sheet styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  modalDismiss: {
    flex: 1,
  },
  checkoutDrawer: {
    backgroundColor: '#18181C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1.5,
    borderTopColor: '#26262B',
    gap: 16,
  },
  drawerIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#26262B',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  checkoutTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: 'bold',
  },
  productSummary: {
    backgroundColor: '#121212',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#26262B',
  },
  productLabel: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  productName: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 4,
  },
  productPrice: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 6,
  },
  payMethodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payMethodBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 12,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#3E3E42',
  },
  payMethodBtnActive: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  payMethodText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputContainer: {
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#1E1E24',
    color: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#3E3E42',
    marginTop: 4,
  },
  checkoutBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  checkoutBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelCheckoutBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelCheckoutBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});
