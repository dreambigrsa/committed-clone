import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { Smile } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { StickerPack, Sticker } from '@/types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_HEIGHT = SCREEN_HEIGHT * 0.6; // 60% of screen height

interface StickerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: Sticker) => void;
}

export default function StickerPicker({
  visible,
  onClose,
  onSelectSticker,
}: StickerPickerProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  
  const translateY = React.useRef(new Animated.Value(BOTTOM_SHEET_HEIGHT)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadStickerPacks();
      // Animate in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: BOTTOM_SHEET_HEIGHT,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  useEffect(() => {
    if (selectedPack) {
      loadStickers(selectedPack.id);
    }
  }, [selectedPack]);

  const loadStickerPacks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('sticker_packs')
        .select('*')
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data) {
        const packsData: StickerPack[] = data.map((pack) => ({
          id: pack.id,
          name: pack.name,
          description: pack.description,
          iconUrl: pack.icon_url,
          isActive: pack.is_active,
          isFeatured: pack.is_featured,
          displayOrder: pack.display_order,
          createdBy: pack.created_by,
          createdAt: pack.created_at,
          updatedAt: pack.updated_at,
        }));
        setPacks(packsData);
        
        // Select first pack by default
        if (packsData.length > 0) {
          setSelectedPack(packsData[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load sticker packs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStickers = async (packId: string) => {
    try {
      setIsLoadingStickers(true);
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', packId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (data) {
        const stickersData: Sticker[] = data.map((sticker) => ({
          id: sticker.id,
          packId: sticker.pack_id,
          name: sticker.name,
          imageUrl: sticker.image_url,
          isAnimated: sticker.is_animated,
          displayOrder: sticker.display_order,
          createdAt: sticker.created_at,
          updatedAt: sticker.updated_at,
        }));
        setStickers(stickersData);
      }
    } catch (error) {
      console.error('Failed to load stickers:', error);
    } finally {
      setIsLoadingStickers(false);
    }
  };

  const handleSelectSticker = (sticker: Sticker) => {
    onSelectSticker(sticker);
    onClose();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: BOTTOM_SHEET_HEIGHT,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5; // Only respond to downward swipes
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > BOTTOM_SHEET_HEIGHT * 0.3) {
          // Swiped down more than 30% - close
          handleClose();
        } else {
          // Spring back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Animated.View
          style={[
            styles.backdropAnimated,
            { opacity },
          ]}
        />
      </TouchableOpacity>

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Drag Handle */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        {/* Pack Selector - Horizontal scroll at top */}
        {packs.length > 0 && (
          <View style={styles.packSelector}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={packs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.packItem,
                    selectedPack?.id === item.id && styles.packItemSelected,
                  ]}
                  onPress={() => setSelectedPack(item)}
                  activeOpacity={0.7}
                >
                  {item.iconUrl ? (
                    <Image
                      source={{ uri: item.iconUrl }}
                      style={styles.packIcon}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={styles.packIconPlaceholder}>
                      <Smile size={24} color={colors.text.secondary} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.packSelectorContent}
            />
          </View>
        )}

        {/* Stickers Grid */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading stickers...</Text>
          </View>
        ) : isLoadingStickers ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : stickers.length > 0 ? (
          <FlatList
            data={stickers}
            numColumns={4}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.stickersGrid}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.stickerItem}
                onPress={() => handleSelectSticker(item)}
                activeOpacity={0.7}
              >
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.stickerImage}
                  contentFit="contain"
                />
              </TouchableOpacity>
            )}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Smile size={48} color={colors.text.tertiary} />
            <Text style={styles.emptyText}>No stickers</Text>
            <Text style={styles.emptySubtext}>
              {selectedPack
                ? 'This pack is empty'
                : 'No sticker packs found'}
            </Text>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  backdropAnimated: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_HEIGHT,
    backgroundColor: colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.medium,
  },
  packSelector: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    paddingVertical: 8,
  },
  packSelectorContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  packItem: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.primary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  packItemSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  packIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  packIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickersGrid: {
    padding: 8,
    paddingBottom: 20,
  },
  stickerItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  stickerImage: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    textAlign: 'center',
  },
});

