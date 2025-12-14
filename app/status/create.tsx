/**
 * Create Status Screen
 * 
 * Facebook-style story creation flow:
 * 1. Gallery picker with story creation tools
 * 2. Privacy settings (gear icon)
 * 3. Text creation screen with style options
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
  Keyboard,
  KeyboardAvoidingView,
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
  Check,
  ChevronDown,
  AtSign,
  Link as LinkIcon,
  MoreHorizontal,
  Palette,
  Smile,
  AlignCenter,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 48) / 3; // 3 columns with padding

type ScreenMode = 'gallery' | 'text' | 'privacy';

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
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [lastStatus, setLastStatus] = useState<any>(null);
  const [lastStatusMediaUrl, setLastStatusMediaUrl] = useState<string | null>(null);

  // Load media assets
  useEffect(() => {
    loadMediaAssets();
    loadLastStatus();
  }, []);

  const loadMediaAssets = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    const assets = await MediaLibrary.getAssetsAsync({
      mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
      sortBy: MediaLibrary.SortBy.creationTime,
      first: 50,
    });

    setMediaAssets(assets.assets);
  };

  const loadLastStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const statuses = await getUserStatuses(currentUser.id);
      if (statuses && statuses.length > 0) {
        const latest = statuses[statuses.length - 1]; // Get most recent (sorted ascending)
        setLastStatus(latest);
        
        // Load media URL if it's a media status
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

    setMediaUri(asset.uri);
    setContentType(asset.mediaType === 'video' ? 'video' : 'image');
    // Navigate to edit/preview screen (you can expand this later)
    handlePost();
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
      // For now, use the first selected item
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setContentType(asset.type === 'video' ? 'video' : 'image');
      handlePost();
    }
  };

  // Render Gallery Picker Screen
  if (screenMode === 'gallery') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create story</Text>
          <TouchableOpacity onPress={() => setScreenMode('privacy')}>
            <Settings size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Story Creation Tools */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolsContainer}>
          <TouchableOpacity style={styles.toolButton} onPress={handleTextOption}>
            <View style={styles.toolIconContainer}>
              <Type size={24} color={colors.text.primary} />
            </View>
            <Text style={styles.toolLabel}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton}>
            <View style={styles.toolIconContainer}>
              <Music size={24} color={colors.text.primary} />
            </View>
            <Text style={styles.toolLabel}>Music</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton}>
            <View style={styles.toolIconContainer}>
              <ImageIcon size={24} color={colors.text.primary} />
            </View>
            <Text style={styles.toolLabel}>AI images</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolButton}>
            <View style={styles.toolIconContainer}>
              <Grid3x3 size={24} color={colors.text.primary} />
            </View>
            <Text style={styles.toolLabel}>Collage</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.largeToolButton} onPress={handleSelectMultiple}>
            <View style={styles.toolIconContainer}>
              <ImageIcon size={28} color={colors.text.primary} />
            </View>
            <Text style={styles.toolLabel}>Select multiple</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Gallery Selector */}
        <TouchableOpacity style={styles.gallerySelector}>
          <Text style={styles.gallerySelectorText}>{selectedGallery}</Text>
          <ChevronDown size={16} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Media Grid */}
        <FlatList
          data={mediaAssets}
          numColumns={3}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridItem}
              onPress={() => handleSelectMedia(item)}
            >
              {item.mediaType === 'video' ? (
                <Video
                  source={{ uri: item.uri }}
                  style={styles.gridMedia}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  useNativeControls={false}
                />
              ) : (
                <Image source={{ uri: item.uri }} style={styles.gridMedia} contentFit="cover" />
              )}
              {item.mediaType === 'video' && (
                <View style={styles.videoIndicator}>
                  <Text style={styles.videoDuration}>
                    {Math.round(item.duration || 0)}s
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // Render Privacy Settings Screen
  if (screenMode === 'privacy') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setScreenMode('gallery')}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Story privacy</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.privacyContent}>
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
                style={styles.privacyOption}
                onPress={() => setPrivacyLevel(option.value as any)}
              >
                <Text style={styles.privacyIcon}>{option.icon}</Text>
                <View style={styles.privacyOptionContent}>
                  <Text style={styles.privacyOptionLabel}>{option.label}</Text>
                  <Text style={styles.privacyOptionSubtitle}>{option.subtitle}</Text>
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
            <TouchableOpacity style={styles.settingsOption}>
              <Text style={styles.settingsIcon}>🔇</Text>
              <Text style={styles.settingsLabel}>Stories you've muted</Text>
              <ChevronDown size={20} color={colors.text.secondary} style={{ transform: [{ rotate: '-90deg' }] }} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Render Text Creation Screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.textHeader}>
        <View style={styles.textHeaderLeft}>
          <TouchableOpacity style={styles.headerIconButton}>
            <Text style={styles.headerIconText}>💬</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <View style={styles.rainbowIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <Type size={20} color={colors.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconButton}>
            <MoreHorizontal size={20} color={colors.text.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={handlePost}
          disabled={isPosting}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.textContent} contentContainerStyle={styles.textContentContainer}>
        {/* Text Input Area */}
        <View style={[styles.textInputArea, { backgroundColor: getBackgroundColor() }]}>
          <TextInput
            style={[styles.textInput, getTextStyle()]}
            placeholder="Type or @Tag"
            placeholderTextColor={colors.text.tertiary}
            value={textContent}
            onChangeText={setTextContent}
            multiline
            autoFocus
            textAlign={textStyle === 'classic' ? 'center' : 'left'}
          />
        </View>

        {/* Text Style Options */}
        <View style={styles.textStyleOptions}>
          <TouchableOpacity
            style={[styles.textStyleOption, textStyle === 'classic' && styles.textStyleOptionActive]}
            onPress={() => setTextStyle('classic')}
          >
            <Text style={[styles.textStyleOptionText, textStyle === 'classic' && styles.textStyleOptionTextActive]}>
              Classic
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.textStyleOption, textStyle === 'neon' && styles.textStyleOptionActive]}
            onPress={() => setTextStyle('neon')}
          >
            <Text style={[styles.textStyleOptionText, textStyle === 'neon' && styles.textStyleOptionTextActive]}>
              Neon
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.textStyleOption, textStyle === 'typewriter' && styles.textStyleOptionActive]}
            onPress={() => setTextStyle('typewriter')}
          >
            <Text style={[styles.textStyleOptionText, textStyle === 'typewriter' && styles.textStyleOptionTextActive]}>
              Typewriter
            </Text>
          </TouchableOpacity>
        </View>

        {/* Options Bar */}
        <View style={styles.optionsBar}>
          <TouchableOpacity style={styles.optionButton}>
            <Music size={20} color={colors.text.primary} />
            <Text style={styles.optionLabel}>Music</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton}>
            <Palette size={20} color={colors.text.primary} />
            <Text style={styles.optionLabel}>Background</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton}>
            <Smile size={20} color={colors.text.primary} />
            <Text style={styles.optionLabel}>Stickers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionButton}>
            <Type size={20} color={colors.text.primary} />
            <Text style={styles.optionLabel}>Fonts</Text>
          </TouchableOpacity>
          {!showMoreOptions ? (
            <TouchableOpacity style={styles.optionButton} onPress={() => setShowMoreOptions(true)}>
              <Text style={styles.optionLabel}>See more</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity style={styles.optionButton}>
                <AtSign size={20} color={colors.text.primary} />
                <Text style={styles.optionLabel}>Mention</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionButton}>
                <LinkIcon size={20} color={colors.text.primary} />
                <Text style={styles.optionLabel}>Link</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionButton} onPress={() => setShowMoreOptions(false)}>
                <Text style={styles.optionLabel}>See less</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Preview of Last Status */}
        {lastStatus && (
          <View style={styles.previewContainer}>
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
    </KeyboardAvoidingView>
  );

  function getBackgroundColor() {
    if (textStyle === 'neon') return '#000';
    if (textStyle === 'typewriter') return '#1a1a1a';
    return '#1A73E8';
  }

  function getTextStyle() {
    const baseStyle: any = {
      fontSize: 24,
      color: textStyle === 'neon' ? '#00ffff' : '#fff',
      fontWeight: textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
    };
    return baseStyle;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  backArrow: {
    fontSize: 24,
    color: '#fff',
  },
  toolsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  toolButton: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  largeToolButton: {
    alignItems: 'center',
    marginRight: 16,
    width: 100,
  },
  toolIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  toolLabel: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
  },
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  gallerySelectorText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
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
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDuration: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  // Privacy Screen Styles
  privacyContent: {
    flex: 1,
    padding: 16,
  },
  privacySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 24,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  privacyIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  privacyOptionContent: {
    flex: 1,
  },
  privacyOptionLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
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
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  settingsIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  // Text Creation Screen Styles
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconText: {
    fontSize: 18,
  },
  rainbowIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A73E8',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  textContent: {
    flex: 1,
  },
  textContentContainer: {
    padding: 16,
  },
  textInputArea: {
    minHeight: 300,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    textAlignVertical: 'center',
    width: '100%',
  },
  textStyleOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  textStyleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  textStyleOptionActive: {
    backgroundColor: '#1A73E8',
  },
  textStyleOptionText: {
    color: '#aaa',
    fontWeight: '500',
  },
  textStyleOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  optionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  optionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  previewContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  statusPreview: {
    width: '100%',
    minHeight: 200,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    padding: 20,
    marginBottom: 12,
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
    borderRadius: 8,
  },
  previewUsername: {
    fontSize: 12,
    color: '#aaa',
  },
});
