/**
 * Create Status Screen
 * 
 * Facebook-style story creation with full-screen text input,
 * vertical options on the right, color picker, text effects,
 * alignment, fonts, and background image support.
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
  Modal,
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 48) / 3;

type ScreenMode = 'gallery' | 'text' | 'privacy' | 'preview';
type TextEffect = 'default' | 'white-bg' | 'black-bg' | 'outline-white' | 'outline-black' | 'glow';
type TextAlignment = 'left' | 'center' | 'right';
type FontStyle = 'classic' | 'neon' | 'typewriter' | 'elegant' | 'bold' | 'italic';

export default function CreateStatusScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { currentUser } = useApp();
  const [screenMode, setScreenMode] = useState<ScreenMode>('gallery');
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [backgroundImageUri, setBackgroundImageUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [isPosting, setIsPosting] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<MediaLibrary.Asset[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<string>('Gallery');
  const [textStyle, setTextStyle] = useState<FontStyle>('classic');
  const [textEffect, setTextEffect] = useState<TextEffect>('default');
  const [textAlignment, setTextAlignment] = useState<TextAlignment>('center');
  
  // Split text into lines for per-line background rendering
  // Each line gets its own independent pill-shaped background
  const textLines = textContent.split('\n');

  // Cycle through text effects when Aa button is clicked
  const cycleTextEffect = () => {
    const effects: TextEffect[] = ['default', 'white-bg', 'black-bg', 'outline-white', 'outline-black', 'glow'];
    const currentIndex = effects.indexOf(textEffect);
    const nextIndex = (currentIndex + 1) % effects.length;
    const nextEffect = effects[nextIndex];
    setTextEffect(nextEffect);
    console.log('🎨 Text effect changed to:', nextEffect); // Debug log
  };

  // Cycle through text alignment when alignment button is clicked
  const cycleTextAlignment = () => {
    const alignments: TextAlignment[] = ['left', 'center', 'right'];
    const currentIndex = alignments.indexOf(textAlignment);
    const nextIndex = (currentIndex + 1) % alignments.length;
    setTextAlignment(alignments[nextIndex]);
  };
  const [textBackgroundColor, setTextBackgroundColor] = useState<string>('#1A73E8');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [lastStatus, setLastStatus] = useState<any>(null);
  const [lastStatusMediaUrl, setLastStatusMediaUrl] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaLibrary.Asset | null>(null);

  const bgColor = isDark ? '#000' : '#fff';
  const textColor = isDark ? '#fff' : '#000';
  const cardBg = isDark ? '#1a1a1a' : '#f5f5f5';
  const borderColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const colorPalette = [
    '#1A73E8', '#1877F2', '#42A5F5', '#66BB6A', '#34A853',
    '#EF5350', '#EA4335', '#FFA726', '#FBBC04', '#AB47BC',
    '#EC407A', '#FF5722', '#00BCD4', '#009688', '#4CAF50',
    '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
    '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#673AB7',
    '#3F51B5', '#2196F3', '#00BCD4', '#009688', '#4CAF50',
    '#000000', '#FFFFFF', '#808080', '#C0C0C0',
  ];

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
      sortBy: MediaLibrary.SortBy.creationTime,
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
      // If background image is set, use it as mediaUri
      const finalMediaUri = backgroundImageUri || mediaUri;
      const status = await createStatus(
        contentType,
        textContent || null,
        finalMediaUri,
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

  const handleBackgroundImageUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setBackgroundImageUri(result.assets[0].uri);
      setShowColorPicker(false);
    }
  };

  // Gallery Picker Screen
  if (screenMode === 'gallery') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <X size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Create story</Text>
          <TouchableOpacity onPress={() => setScreenMode('privacy')} style={styles.headerButton}>
            <Settings size={24} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Story Creation Tools */}
        <View style={[styles.toolsSection, { borderBottomColor: borderColor }]}>
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
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Type size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Music size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Music</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <ImageIcon size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>AI images</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolCard} activeOpacity={0.8}>
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Grid3x3 size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Collage</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardLarge]} 
              onPress={handleSelectMultiple}
              activeOpacity={0.8}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <ImageIcon size={32} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Select multiple</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toolCard, styles.toolCardCamera]} 
              onPress={handleTakePhoto}
              activeOpacity={0.8}
            >
              <View style={[styles.toolIconWrapper, { backgroundColor: cardBg, borderColor }]}>
                <Camera size={28} color={colors.primary} />
              </View>
              <Text style={[styles.toolLabel, { color: textColor }]}>Camera</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Gallery Selector */}
        <TouchableOpacity 
          style={[styles.gallerySelector, { borderBottomColor: borderColor }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.gallerySelectorText, { color: textColor }]}>{selectedGallery}</Text>
          <ChevronDown size={18} color={colors.text.secondary} />
        </TouchableOpacity>

        {/* Media Grid */}
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
      <SafeAreaView style={[styles.container, { backgroundColor: bgColor }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        
        <View style={[styles.header, { borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => setScreenMode('gallery')} style={styles.headerButton}>
            <ChevronRight size={24} color={textColor} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Story privacy</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.privacyContent} showsVerticalScrollIndicator={false}>
          <View style={styles.privacySection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Who can see your story?</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.text.secondary }]}>
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
                  { backgroundColor: cardBg },
                  privacyLevel === option.value && { backgroundColor: colors.primary + '20', borderColor: colors.primary, borderWidth: 1 },
                ]}
                onPress={() => setPrivacyLevel(option.value as any)}
                activeOpacity={0.7}
              >
                <View style={styles.privacyOptionLeft}>
                  <Text style={styles.privacyIcon}>{option.icon}</Text>
                  <View style={styles.privacyOptionContent}>
                    <Text style={[styles.privacyOptionLabel, { color: textColor }]}>{option.label}</Text>
                    <Text style={[styles.privacyOptionSubtitle, { color: colors.text.secondary }]}>{option.subtitle}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.radioButton,
                    { borderColor: colors.border.medium },
                    privacyLevel === option.value && { borderColor: colors.primary },
                  ]}
                >
                  {privacyLevel === option.value && (
                    <View style={[styles.radioButtonInner, { backgroundColor: colors.primary }]} />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.privacySection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Other settings</Text>
            <TouchableOpacity style={[styles.settingsOption, { backgroundColor: cardBg }]} activeOpacity={0.7}>
              <Text style={styles.settingsIcon}>🔇</Text>
              <Text style={[styles.settingsLabel, { color: textColor }]}>Stories you've muted</Text>
              <ChevronRight size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Preview Screen
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

  // Text Creation Screen - Facebook Style Full Screen
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: textBackgroundColor }]}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.flex1}>
        {/* Header - Simple header */}
        <View style={styles.textHeader}>
          <TouchableOpacity 
            style={styles.textHeaderIconButton}
            onPress={() => setScreenMode('gallery')}
          >
            <ChevronRight size={20} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <View style={styles.textHeaderRight}>
            <TouchableOpacity style={styles.textHeaderIconButton}>
              <Smile size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.textHeaderIconButton}>
              <MoreHorizontal size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Screen Text Input with Background */}
        <View style={styles.fullScreenTextContainer}>
          {backgroundImageUri ? (
            <Image 
              source={{ uri: backgroundImageUri }} 
              style={styles.backgroundImage} 
              contentFit="cover" 
            />
          ) : (
            <View style={[styles.textInputArea, { backgroundColor: textBackgroundColor }]} />
          )}
          
          {/* Text Input Area - Single Unified Background Container */}
          <View style={styles.textInputWrapper}>
            {/* Single Unified Background Container - wraps all text together like second image */}
            {(textEffect === 'white-bg' || textEffect === 'black-bg') && textContent && (
              <View
                style={[
                  styles.unifiedTextBackground,
                  {
                    backgroundColor: textEffect === 'white-bg' ? '#fff' : '#000',
                    shadowColor: textEffect === 'white-bg' ? '#000' : '#fff',
                    alignSelf: textAlignment === 'left' ? 'flex-start' : 
                              textAlignment === 'right' ? 'flex-end' : 'center',
                  },
                ]}
                pointerEvents="none"
              >
                {/* Invisible text for sizing - TextInput handles actual display */}
                <Text
                  style={[
                    getTextStyle(),
                    {
                      textAlign: textAlignment,
                      color: 'transparent',
                      opacity: 0,
                    },
                  ]}
                >
                  {textContent}
                </Text>
              </View>
            )}
            
            {/* Main text input - Independent text layer positioned over unified background */}
            <TextInput
              style={[
                styles.fullScreenTextInput,
                getTextStyle(),
                getTextEffectStyle(),
                { 
                  textAlign: textAlignment,
                  alignSelf: textAlignment === 'left' ? 'flex-start' : 
                            textAlignment === 'right' ? 'flex-end' : 'center',
                },
                (textEffect === 'white-bg' || textEffect === 'black-bg') && {
                  backgroundColor: 'transparent',
                  color: textEffect === 'white-bg' ? '#000' : '#fff',
                  // Match padding exactly with unified background for perfect overlay alignment
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                },
              ]}
              placeholder="Type or @Tag"
              placeholderTextColor={getPlaceholderColor()}
              value={textContent}
              onChangeText={setTextContent}
              multiline
              autoFocus
            />
          </View>
        </View>

        {/* Color Picker Modal */}
        {showColorPicker && (
          <Modal
            visible={showColorPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowColorPicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowColorPicker(false)}
            >
              <View style={[styles.colorPickerContainer, { backgroundColor: cardBg }]}>
                <View style={styles.colorPickerHeader}>
                  <Text style={[styles.colorPickerTitle, { color: textColor }]}>Background</Text>
                  <TouchableOpacity onPress={() => setShowColorPicker(false)}>
                    <X size={24} color={textColor} />
                  </TouchableOpacity>
                </View>
                
                {/* Color Circles */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.colorPaletteContainer}
                >
                  {colorPalette.map((color, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: color },
                        textBackgroundColor === color && styles.colorCircleSelected,
                      ]}
                      onPress={() => {
                        setTextBackgroundColor(color);
                        setBackgroundImageUri(null); // Clear background image when color is selected
                      }}
                      activeOpacity={0.7}
                    />
                  ))}
                </ScrollView>

                {/* Upload Background Image */}
                <TouchableOpacity
                  style={[styles.uploadBackgroundButton, { backgroundColor: colors.primary }]}
                  onPress={handleBackgroundImageUpload}
                  activeOpacity={0.7}
                >
                  <Upload size={20} color="#fff" />
                  <Text style={styles.uploadBackgroundText}>Upload background image</Text>
                </TouchableOpacity>

                {/* Remove Background */}
                {backgroundImageUri && (
                  <TouchableOpacity
                    style={[styles.removeBackgroundButton, { borderColor: colors.danger }]}
                    onPress={() => {
                      setBackgroundImageUri(null);
                      setShowColorPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <X size={20} color={colors.danger} />
                    <Text style={[styles.removeBackgroundText, { color: colors.danger }]}>
                      Remove background image
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}

      </SafeAreaView>
    </KeyboardAvoidingView>
  );

  function getTextStyle() {
    const baseStyle: any = {
      fontSize: textStyle === 'typewriter' ? 20 : textStyle === 'elegant' ? 24 : 32,
      color: textEffect === 'black-bg' ? '#fff' : textEffect === 'white-bg' ? '#000' : '#fff',
      fontWeight: textStyle === 'bold' ? ('700' as const) : textStyle === 'typewriter' ? ('400' as const) : ('600' as const),
      fontStyle: textStyle === 'italic' ? ('italic' as const) : ('normal' as const),
    };

    // Font family
    if (textStyle === 'typewriter') {
      baseStyle.fontFamily = 'monospace';
    } else if (textStyle === 'elegant') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
    } else if (textStyle === 'neon') {
      baseStyle.fontFamily = Platform.OS === 'ios' ? 'Arial' : 'sans-serif-medium';
    }

    return baseStyle;
  }

  function getPlaceholderColor() {
    switch (textEffect) {
      case 'white-bg':
        return 'rgba(0, 0, 0, 0.4)';
      case 'black-bg':
        return 'rgba(255, 255, 255, 0.5)';
      default:
        return 'rgba(255, 255, 255, 0.6)';
    }
  }

  function getTextEffectStyle() {
    const styles: any = {};
    
    switch (textEffect) {
      case 'white-bg':
        // Text color handled by inline style override
        // Background is rendered by Text component layer behind
        // No text shadow needed
        break;
      case 'black-bg':
        // Text color handled by inline style override
        // Background is rendered by Text component layer behind
        // No text shadow needed
        break;
      case 'outline-white':
        // Thin white outline
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'outline-black':
        // Thin black outline
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'glow':
        // Glowing effect
        styles.textShadowColor = textBackgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 20;
        break;
    }
    
    return styles;
  }

  function getEffectPreviewStyle(effect: TextEffect) {
    const styles: any = {
      fontSize: 24,
      fontWeight: '600' as const,
    };
    
    switch (effect) {
      case 'white-bg':
        styles.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        styles.color = '#000';
        break;
      case 'black-bg':
        styles.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        styles.color = '#fff';
        break;
      case 'outline-white':
        styles.color = textBackgroundColor;
        styles.textShadowColor = '#fff';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'outline-black':
        styles.color = '#fff';
        styles.textShadowColor = '#000';
        styles.textShadowOffset = { width: -1, height: 1 };
        styles.textShadowRadius = 2;
        break;
      case 'glow':
        styles.color = '#fff';
        styles.textShadowColor = textBackgroundColor;
        styles.textShadowOffset = { width: 0, height: 0 };
        styles.textShadowRadius = 10;
        break;
      default:
        styles.color = '#fff';
    }
    
    return styles;
  }

  function getFontPreviewStyle(font: FontStyle) {
    const styles: any = {
      fontSize: 18,
      color: textColor,
    };
    
    switch (font) {
      case 'bold':
        styles.fontWeight = '700' as const;
        break;
      case 'italic':
        styles.fontStyle = 'italic' as const;
        break;
      case 'neon':
        styles.color = '#00ffff';
        break;
      case 'elegant':
        styles.fontFamily = Platform.OS === 'ios' ? 'Georgia' : 'serif';
        break;
      case 'typewriter':
        styles.fontFamily = 'monospace';
        break;
    }
    
    return styles;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    borderBottomWidth: 1,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  toolsSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 2,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  gallerySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  gallerySelectorText: {
    fontSize: 16,
    fontWeight: '600' as const,
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 20,
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
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
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  privacyOptionSubtitle: {
    fontSize: 14,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingsIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  settingsLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
  },
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
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    backgroundColor: 'transparent',
  },
  textHeaderRight: {
    flexDirection: 'row',
    gap: 8,
  },
  textHeaderIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Header Text Style Buttons (Classic, Neon, Typewriter)
  headerTextStyleButtons: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextStyleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerTextStyleButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  headerTextStyleButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#fff',
  },
  headerTextStyleButtonTextActive: {
    color: '#000',
    fontWeight: '700' as const,
  },
  // Header Color Dot
  headerColorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Header Aa Button
  aaButtonHeader: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  // Header Done Button
  headerDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#EF4444',
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDoneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  fullScreenTextContainer: {
    flex: 1,
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  textInputArea: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  textInputWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 0,
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  // Single Unified Background Container - wraps all text together (like second image)
  unifiedTextBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1, // Below TextInput (zIndex: 2) but above background
    pointerEvents: 'none', // Cannot block clicks
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16, // Round and soft edges
    // Soft shadow creates depth
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
    // View wraps transparent Text that determines width - single unified container
    maxWidth: '85%',
    alignSelf: 'center',
  },
  fullScreenTextInput: {
    width: '100%',
    height: '100%',
    textAlignVertical: 'center',
    paddingHorizontal: 24,
    paddingVertical: 0,
    zIndex: 2, // Above background layer
    backgroundColor: 'transparent',
    // Remove any visible box constraints
    borderWidth: 0,
    outlineWidth: 0,
  },
  textInputWithBg: {
    position: 'relative',
  },
  verticalOptionsContainer: {
    position: 'absolute',
    right: 16,
    top: height * 0.3,
    alignItems: 'center',
    gap: 12,
    zIndex: 10, // Above everything - buttons must be clickable
    elevation: 10, // Android elevation
  },
  verticalOptionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPreviewCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  aaButton: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  verticalDoneButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  colorPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: height * 0.5,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  colorPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  colorPaletteContainer: {
    gap: 12,
    paddingVertical: 10,
  },
  colorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleSelected: {
    borderColor: '#1A73E8',
    borderWidth: 3,
  },
  uploadBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  uploadBackgroundText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  removeBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 12,
  },
  removeBackgroundText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  fontPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: height * 0.6,
  },
  fontPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fontPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  effectSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  effectOptions: {
    gap: 12,
  },
  effectOption: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  effectPreview: {
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  effectLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  fontSection: {
    marginBottom: 24,
  },
  fontOptions: {
    gap: 12,
  },
  fontOption: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fontPreview: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  alignmentPickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  alignmentPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  alignmentPickerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  alignmentOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  alignmentOption: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alignmentLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  // Text Style Selector at Bottom - Facebook Style
  textStyleSelectorContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10, // Above everything - buttons must be clickable
    elevation: 10, // Android elevation
  },
  textStyleButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: 75,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  textStyleButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  textStyleButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  textStyleButtonTextActive: {
    color: '#000',
    fontWeight: '700' as const,
  },
});
