/**
 * Create Status Screen
 * 
 * Beautiful, modern story creation flow with:
 * - Gallery/media picker with story creation tools
 * - Privacy settings
 * - Text creation with style options
 * - Preview and posting
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  FlatList,
  Dimensions,
  KeyboardAvoidingView,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { createStatus, getUserStatuses, getSignedUrlForMedia } from '@/lib/status-queries';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { 
  X, 
  Settings, 
  Music, 
  Type, 
  Image as ImageIcon, 
  Grid3x3,
  ChevronDown,
  AtSign,
  Link as LinkIcon,
  MoreHorizontal,
  Palette,
  Smile,
  Camera,
  Check,
  ChevronRight,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 48) / 3; // 3 columns with padding

type ScreenMode = 'gallery' | 'text' | 'privacy' | 'preview';

export default function CreateStatusScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const [screenMode, setScreenMode] = useState<ScreenMode>('gallery');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [isPosting, setIsPosting] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('Gallery');
  const [textStyle, setTextStyle] = useState<'classic' | 'neon' | 'typewriter'>('classic');
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('#1A73E8');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [lastStatus, setLastStatus] = useState<any>(null);
  const [lastStatusMediaUrl, setLastStatusMediaUrl] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaLibrary.Asset | null>(null);

  useEffect(() => {
    loadMediaAssets();
    loadLastStatus();
  }, []);

  const loadMediaAssets = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to create stories.');
      return;
    }

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: MediaLibrary.MediaType.video ? MediaLibrary.SortBy.creationTime : MediaLibrary.SortBy.creationTime,
      first: 100,
    });

    setMediaAssets(assets.assets);
  };

  const loadLastStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const statuses = await getUserStatuses(currentUser.id);
      if (statuses && statuses.length > 0) {
        const latest = statuses[statuses.length - 1];
        setLastStatus(latest);
        
        if (latest.media_path && (latest.content_type === 'image' || latest.content_type === 'video')) {
          try {
            const url = await getSignedUrlForMedia(latest.media_path);
            setLastStatusMediaUrl(url);
          } catch (error) {
            console.error('Error loading last status media:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error loading last status:', error);
    }
  };

  const handleSelectMedia = async (asset: MediaLibrary.Asset) => {
    if (asset.mediaType === 'video' && asset.duration && asset.duration > 15) {
      Alert.alert('Video Too Long', 'Story videos must be 15 seconds or less.');
      return;
    }

    setSelectedMedia(asset);
    setMediaUri(asset.uri);
    setContentType(asset.mediaType === 'video' ? 'video' : 'image');
    setScreenMode('preview');
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need camera access to take photos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('image');
      setScreenMode('preview');
    }
  };

  const handlePost = async () => {
    if (contentType === 'text' && !textContent.trim()) {
      Alert.alert('Required', 'Please enter some text for your status.');
      return;
    }

    if (contentType !== 'text' && !mediaUri) {
      Alert.alert('Required', 'Please select media.');
      return;
    }

    setIsPosting(true);
    try {
      const status = await createStatus(
        contentType,
        textContent || null,
        mediaUri,
        privacyLevel
      );

      if (status) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to post status. Please try again.');
      }
    } catch (error) {
      console.error('Error creating status:', error);
      Alert.alert('Error', 'Failed to post status. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleTextOption = () => {
    setScreenMode('text');
    setContentType('text');
  };

  const handleSelectMultiple = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      handleSelectMedia({
        id: asset.uri,
        uri: asset.uri,
        mediaType: asset.type === 'video' ? 'video' : 'photo',
        duration: asset.duration || 0,
        width: asset.width || 0,
        height: asset.height || 0,
        creationTime: Date.now(),
        modificationTime: Date.now(),
        albumId: '',
      } as MediaLibrary.Asset);
    }
  };

  // Gallery Picker Screen
  if (screenMode === 'gallery') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create story</Text>
          <TouchableOpacity onPress={() => setScreenMode('privacy')} style={styles.headerButton}>
            <Settings size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Story Creation Tools - Better Design */}
        <View style={styles.toolsSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.toolsScrollContent}
          >
            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardPrimary]} 
              onPress={handleTextOption}
              activeOpacity={0.8}
            >
              <View style={styles.toolIconWrapper}>
                <Type size={28} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={styles.toolIconWrapper}>
                <Music size={28} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>Music</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={styles.toolIconWrapper}>
                <ImageIcon size={28} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>AI images</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={styles.toolIconWrapper}>
                <Grid3x3 size={28} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>Collage</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardLarge]} 
              onPress={handleSelectMultiple}
              activeOpacity={0.8}
            >
              <View style={styles.toolIconWrapper}>
                <ImageIcon size={32} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>Select multiple</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardCamera]} 
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <View style={styles.toolIconWrapper}>
                <Camera size={28} color="#fff" />
              </View>
              <Text style={styles.toolLabel}>Camera</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Gallery Selector */}
        <TouchableOpacity 
          style={styles.gallerySelector}
          activeOpacity={0.7}
        >
          <Text style={styles.gallerySelectorText}>{selectedGallery}</Text>
          <ChevronDown size={18} color="#999" />
        </TouchableOpacity>

        {/* Media Grid - Better Design */}
        <FlatList
          data={mediaAssets}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => handleSelectMedia(item)}
              activeOpacity={0.8}
            >
              {item.mediaType === 'video' ? (
                <>
                  <Video
                    source={{ uri: item.uri }}
                    style={styles.gridMedia}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    useNativeControls={false}
                  />
                  <View style={styles.videoOverlay}>
                    <View style={styles.videoBadge}>
                      <Text style={styles.videoDuration}>
                        {Math.round(item.duration || 0)}s
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.gridMedia} contentFit="cover" />
              )}
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    );
  }

  // Privacy Settings Screen
  if (screenMode === 'privacy') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1a1a1a' }]}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreenMode('gallery')} style={styles.headerButton}>
            <ChevronRight size={24} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Story privacy</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.privacyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.privacySection}>
            <Text style={styles.sectionTitle}>Who can see your story?</Text>
            <Text style={styles.sectionSubtitle}>
              Your story will be visible for 24 hours on Committed and Messages.
            </Text>

            {[
              { value: 'public', label: 'Public', subtitle: 'Anyone on Committed or Messages', icon: '🌐' },
              { value: 'friends', label: 'Friends', subtitle: 'Only your friends', icon: '👥' },
              { value: 'followers', label: 'Followers', subtitle: 'Only your followers', icon: '👤' },
              { value: 'only_me', label: 'Only Me', subtitle: 'Just you', icon: '🔒' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.privacyOption,
                  privacyLevel === option.value && styles.privacyOptionActive,
                ]}
                onPress={() => setPrivacyLevel(option.value as any)}
                activeOpacity={0.7}
              >
                <View style={styles.privacyOptionLeft}>
                  <Text style={styles.privacyIcon}>{option.icon}</Text>
                  <View style={styles.privacyOptionContent}>
                    <Text style={styles.privacyOptionLabel}>{option.label}</Text>
                    <Text style={styles.privacyOptionSubtitle}>{option.subtitle}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    privacyLevel === option.value && styles.radioButtonSelected,
                  ]}
                >
                  {privacyLevel === option.value && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.privacySection}>
            <Text style={styles.sectionTitle}>Other settings</Text>
            <TouchableOpacity style={styles.settingsOption} activeOpacity={0.7}>
              <Text style={styles.settingsIcon}>🔇</Text>
              <Text style={styles.settingsLabel}>Stories you've muted</Text>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Preview Screen (for media)
  if (screenMode === 'preview' && mediaUri) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.previewHeader}>
          <TouchableOpacity 
            onPress={() => {
              setScreenMode('gallery');
              setMediaUri(null);
              setSelectedMedia(null);
            }} 
            style={styles.headerButton}
          >
            <ChevronRight size={24} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preview</Text>
          <TouchableOpacity 
            onPress={handlePost} 
            style={styles.postButton}
            disabled={isPosting}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.previewContent}>
          {contentType === 'image' ? (
            <Image source={{ uri: mediaUri }} style={styles.previewMediaFull} contentFit="contain" />
          ) : (
            <Video
              source={{ uri: mediaUri }}
              style={styles.previewMediaFull}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping
              useNativeControls
            />
          )}
        </View>

        {/* Privacy Badge */}
        <TouchableOpacity 
          style={styles.privacyBadge}
          onPress={() => setScreenMode('privacy')}
        >
          <Text style={styles.privacyBadgeText}>
            {privacyLevel === 'public' ? '🌐' : 
             privacyLevel === 'friends' ? '👥' : 
             privacyLevel === 'followers' ? '👤' : '🔒'} {privacyLevel.charAt(0).toUpperCase() + privacyLevel.slice(1)}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Text Creation Screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: '#000' }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.flex1}>
        {/* Header */}
        <View style={styles.textHeader}>
          <View style={styles.textHeaderLeft}>
            <TouchableOpacity 
              style={styles.textHeaderIconButton}
              onPress={() => setScreenMode('gallery')}
            >
              <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.textHeaderIconButton}>
              <Text style={styles.emojiIcon}>💬</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.textHeaderIconButton}
              onPress={() => {
                const colors = ['#1A73E8', '#1877F2', '#42A5F5', '#66BB6A', '#EF5350', '#FFA726', '#AB47BC', '#EC407A'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                setTextBackgroundColor(randomColor);
              }}
            >
              <View style={[styles.colorDot, { backgroundColor: textBackgroundColor }]} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.textHeaderIconButton}>
              <Type size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.textHeaderIconButton}>
              <MoreHorizontal size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.doneButton, isPosting && styles.doneButtonDisabled]}
            onPress={handlePost}
            disabled={isPosting || !textContent.trim()}
          >
            {isPosting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneButtonText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={styles.textContent} 
          contentContainerStyle={styles.textContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Text Input Area - Better Design */}
          <View style={[styles.textInputArea, { backgroundColor: textBackgroundColor }]}>
            <TextInput
              style={[styles.textInput, getTextStyle()]}
              placeholder="Type or @Tag"
              placeholderTextColor="rgba(255, 255, 255, 0.6)"
              value={textContent}
              onChangeText={setTextContent}
              multiline
              autoFocus
              textAlign={textStyle === 'classic' ? 'center' : 'left'}
            />
          </View>

          {/* Text Style Options - Better Design */}
          <View style={styles.textStyleContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.textStyleScroll}>
              {(['classic', 'neon', 'typewriter'] as const).map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.textStyleOption,
                    textStyle === style && styles.textStyleOptionActive,
                  ]}
                  onPress={() => setTextStyle(style)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.textStyleOptionText,
                    textStyle === style && styles.textStyleOptionTextActive,
                  ]}>
                    {style.charAt(0).toUpperCase() + style.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Options Bar - Better Layout */}
          <View style={styles.optionsContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.optionsScroll}
            >
              <OptionButton icon={<Music size={20} color="#fff" />} label="Music" />
              <OptionButton 
                icon={<Palette size={20} color="#fff" />} 
                label="Background"
                onPress={() => {
                  const colors = ['#1A73E8', '#1877F2', '#42A5F5', '#66BB6A', '#EF5350', '#FFA726', '#AB47BC', '#EC407A', '#000', '#fff'];
                  const randomColor = colors[Math.floor(Math.random() * colors.length)];
                  setTextBackgroundColor(randomColor);
                }}
              />
              <OptionButton icon={<Smile size={20} color="#fff" />} label="Stickers" />
              <OptionButton icon={<Type size={20} color="#fff" />} label="Fonts" />
              
              {!showMoreOptions ? (
                <TouchableOpacity 
                  style={styles.optionButton}
                  onPress={() => setShowMoreOptions(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionLabel}>See more</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <OptionButton icon={<AtSign size={20} color="#fff" />} label="Mention" />
                  <OptionButton icon={<LinkIcon size={20} color="#fff" />} label="Link" />
                  <TouchableOpacity 
                    style={styles.optionButton}
                    onPress={() => setShowMoreOptions(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.optionLabel}>See less</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* Preview of Last Status */}
          {lastStatus && (
            <View style={styles.previewContainer}>
              <Text style={styles.previewSectionTitle}>Your last story</Text>
              <View style={[styles.statusPreview, lastStatus.content_type === 'text' && styles.statusPreviewCentered]}>
                {lastStatus.content_type === 'text' ? (
                  <Text style={styles.previewText}>{lastStatus.text_content || 'Your last status'}</Text>
                ) : lastStatusMediaUrl ? (
                  lastStatus.content_type === 'video' ? (
                    <Video
                      source={{ uri: lastStatusMediaUrl }}
                      style={styles.previewMedia}
                      resizeMode={ResizeMode.COVER}
                      shouldPlay={false}
                      useNativeControls={false}
                    />
                  ) : (
                    <Image
                      source={{ uri: lastStatusMediaUrl }}
                      style={styles.previewMedia}
                      contentFit="cover"
                    />
                  )
                ) : null}
              </View>
              <Text style={styles.previewUsername}>{currentUser?.fullName || 'You'}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  function getTextStyle() {
    const baseStyle: any = {
      fontSize: textStyle === 'typewriter' ? 20 : 28,
      color: textStyle === 'neon' ? '#00ffff' : '#fff',
      fontWeight: textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
      fontFamily: textStyle === 'typewriter' ? 'monospace' : undefined,
    };
    return baseStyle;
  }
}

// Option Button Component
function OptionButton({ 
  icon, 
  label, 
  onPress 
}: { 
  icon: React.ReactNode; 
  label: string; 
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity 
      style={styles.optionButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {icon}
      <Text style={styles.optionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Tools Section
  toolsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  toolsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  toolCard: {
    width: 80,
    alignItems: 'center',
    marginRight: 12,
  },
  toolCardPrimary: {
    width: 90,
  },
  toolCardLarge: {
    width: 110,
  },
  toolCardCamera: {
    width: 85,
  },
  toolIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  toolLabel: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  // Gallery Selector
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  gallerySelectorText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600' as const,
  },
  // Grid Styles
  gridContainer: {
    padding: 16,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    margin: 2,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  gridMedia: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  videoBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  // Privacy Screen
  privacyContent: {
    flex: 1,
    padding: 16,
  },
  privacySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#aaa',
    marginBottom: 24,
    lineHeight: 20,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    marginBottom: 12,
  },
  privacyOptionActive: {
    backgroundColor: 'rgba(26, 115, 232, 0.2)',
    borderWidth: 1,
    borderColor: '#1A73E8',
  },
  privacyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  privacyIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  privacyOptionContent: {
    flex: 1,
  },
  privacyOptionLabel: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  privacyOptionSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#1A73E8',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1A73E8',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    marginBottom: 12,
  },
  settingsIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 17,
    color: '#fff',
    fontWeight: '600' as const,
  },
  // Preview Screen
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
  },
  previewContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewMediaFull: {
    width: width,
    height: height * 0.75,
  },
  privacyBadge: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  privacyBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#1A73E8',
    borderRadius: 20,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 16,
  },
  // Text Creation Screen
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textHeaderIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: {
    fontSize: 18,
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  doneButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1A73E8',
    borderRadius: 20,
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 16,
  },
  textContent: {
    flex: 1,
  },
  textContentContainer: {
    padding: 16,
  },
  textInputArea: {
    minHeight: 300,
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  textInput: {
    flex: 1,
    textAlignVertical: 'center',
    width: '100%',
    minHeight: 200,
  },
  textStyleContainer: {
    marginBottom: 20,
  },
  textStyleScroll: {
    gap: 12,
    paddingRight: 16,
  },
  textStyleOption: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginRight: 12,
  },
  textStyleOptionActive: {
    backgroundColor: '#1A73E8',
    borderColor: '#1A73E8',
  },
  textStyleOptionText: {
    color: '#aaa',
    fontWeight: '500' as const,
    fontSize: 14,
  },
  textStyleOptionTextActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  optionsScroll: {
    gap: 12,
    paddingRight: 16,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  previewContainer: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 40,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#aaa',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  statusPreview: {
    width: '100%',
    minHeight: 200,
    borderRadius: 16,
    backgroundColor: '#1a1a1a',
    padding: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  statusPreviewCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
  previewMedia: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  previewUsername: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500' as const,
  },
});
