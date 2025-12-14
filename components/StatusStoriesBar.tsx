/**
 * StatusStoriesBar Component
 * 
 * Horizontal scrollable bar displaying user status stories
 * Used in both Feed and Messages screens (like Facebook/Messenger)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getStatusFeedForFeed, getStatusFeedForMessenger, getSignedUrlForMedia } from '@/lib/status-queries';
import type { StatusFeedItem } from '@/lib/status-queries';
import { LinearGradient } from 'expo-linear-gradient';

interface StatusStoriesBarProps {
  /**
   * Context: 'feed' for Feed screen, 'messenger' for Messages screen
   * Determines which query to use and user filtering
   */
  context: 'feed' | 'messenger';
  /**
   * Callback when a status is tapped
   * If not provided, opens default status viewer
   */
  onStatusPress?: (statusItem: StatusFeedItem) => void;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = 112; // Facebook-style card width
const CARD_HEIGHT = 200; // Facebook-style card height
const CARD_MARGIN = 8;
const BUBBLE_SIZE = 64; // For other users' circular bubbles
const BUBBLE_MARGIN = 8;

/**
 * Other User Story Card Component
 * Facebook-style card showing preview of other users' statuses (Feed only)
 */
function OtherUserStoryCard({
  statusItem,
  hasUnviewed,
  onPress,
}: {
  statusItem: StatusFeedItem;
  hasUnviewed: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = statusItem.latest_status;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (status.media_path) {
        try {
          const url = await getSignedUrlForMedia(status.media_path);
          if (isMounted) {
            setPreviewUrl(url);
          }
        } catch (error) {
          console.error('Error loading other user story preview:', error);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [status.media_path]);

  const cardStyles = StyleSheet.create({
    card: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
      borderWidth: hasUnviewed ? 2 : 0,
      borderColor: hasUnviewed ? colors.primary : 'transparent',
    },
    cardImage: {
      width: '100%',
      height: '100%',
    },
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
    },
    cardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
      paddingTop: 12,
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700' as const,
      marginBottom: 4,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '500' as const,
      textAlign: 'center',
      marginBottom: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    profileBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: hasUnviewed ? colors.primary : colors.background.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
  });

  // Get preview image or use gradient background
  const hasMedia = status.media_path && (status.content_type === 'image' || status.content_type === 'video');
  const displayText = status.text_content || '';
  const truncatedText = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;

  return (
    <TouchableOpacity style={{ marginHorizontal: CARD_MARGIN, width: CARD_WIDTH }} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.card}>
        {/* Background - media preview or gradient */}
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={cardStyles.cardImage} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD', colors.primary + 'AA']}
            style={cardStyles.cardImage}
          />
        )}

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={cardStyles.gradientOverlay}
        />

        {/* Profile picture badge at top */}
        <View style={cardStyles.profileBadge}>
          {statusItem.user_avatar ? (
            <Image
              source={{ uri: statusItem.user_avatar }}
              style={cardStyles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={[cardStyles.profileImage, { backgroundColor: colors.background.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
                {statusItem.user_name?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Content overlay */}
        <View style={cardStyles.cardOverlay}>
          {/* Title - username */}
          <Text style={cardStyles.cardTitle} numberOfLines={1}>
            {statusItem.user_name || 'User'}
          </Text>
          
          {/* Status text preview */}
          {status.text_content && (
            <Text style={cardStyles.cardText} numberOfLines={2}>
              {truncatedText}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Your Story Card Component
 * Facebook-style card showing preview of user's own status
 */
function YourStoryCard({
  statusItem,
  currentUser,
  onPress,
}: {
  statusItem: StatusFeedItem;
  currentUser: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const status = statusItem.latest_status;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (status.media_path) {
        try {
          const url = await getSignedUrlForMedia(status.media_path);
          if (isMounted) {
            setPreviewUrl(url);
          }
        } catch (error) {
          console.error('Error loading your story preview:', error);
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [status.media_path]);

  const cardStyles = StyleSheet.create({
    yourCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    yourCardImage: {
      width: '100%',
      height: '100%',
    },
    gradientOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
    },
    yourCardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 10,
      paddingTop: 12,
    },
    cardTitle: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700' as const,
      marginBottom: 4,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '500' as const,
      textAlign: 'center',
      marginBottom: 4,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardStats: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      marginTop: 2,
    },
    cardStat: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '600' as const,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    cardLabel: {
      color: '#FFFFFF',
      fontSize: 9,
      textAlign: 'center',
      marginTop: 4,
      opacity: 0.9,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    profileBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 3,
      borderColor: colors.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
  });

  // Get preview image or use gradient background
  const hasMedia = status.media_path && (status.content_type === 'image' || status.content_type === 'video');
  const displayText = status.text_content || 'Your Story';
  const truncatedText = displayText.length > 30 ? displayText.substring(0, 30) + '...' : displayText;

  return (
    <TouchableOpacity style={{ marginHorizontal: CARD_MARGIN, width: CARD_WIDTH }} onPress={onPress} activeOpacity={0.8}>
      <View style={cardStyles.yourCard}>
        {/* Background - media preview or gradient */}
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={cardStyles.yourCardImage} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[colors.primary, colors.primary + 'DD', colors.primary + 'AA']}
            style={cardStyles.yourCardImage}
          />
        )}

        {/* Gradient overlay for text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={cardStyles.gradientOverlay}
        />

        {/* Profile picture badge at top */}
        <View style={cardStyles.profileBadge}>
          {statusItem.user_avatar || currentUser?.profilePicture ? (
            <Image
              source={{ uri: statusItem.user_avatar || currentUser?.profilePicture }}
              style={cardStyles.profileImage}
              contentFit="cover"
            />
          ) : (
            <View style={[cardStyles.profileImage, { backgroundColor: colors.background.primary, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>
                {currentUser?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </View>

        {/* Content overlay */}
        <View style={cardStyles.yourCardOverlay}>
          {/* Title - username or app name */}
          <Text style={cardStyles.cardTitle} numberOfLines={1}>
            {statusItem.user_name || 'Committed'}
          </Text>
          
          {/* Status text preview */}
          {status.text_content && (
            <Text style={cardStyles.cardText} numberOfLines={2}>
              {truncatedText}
            </Text>
          )}

          {/* Stats (if you want to add view count, etc.) */}
          {status.text_content && (
            <View style={cardStyles.cardStats}>
              <Text style={cardStyles.cardStat}>•</Text>
              <Text style={cardStyles.cardStat}>Active</Text>
            </View>
          )}

          {/* Status label */}
          <Text style={cardStyles.cardLabel}>Sharing...</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Story Preview Bubble Component
 * Shows a preview of the story content (like Facebook)
 */
function StoryPreviewBubble({
  mediaPath,
  contentType,
  profilePicture,
  userName,
}: {
  mediaPath: string;
  contentType: 'image' | 'video';
  profilePicture: string | null;
  userName: string;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      try {
        const url = await getSignedUrlForMedia(mediaPath);
        if (isMounted) {
          setPreviewUrl(url);
        }
      } catch (error) {
        console.error('Error loading story preview:', error);
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [mediaPath]);

  const styles = StyleSheet.create({
    previewContainer: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
      overflow: 'hidden',
      position: 'relative',
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    profileOverlay: {
      position: 'absolute',
      bottom: 2,
      left: 2,
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.background.primary,
      overflow: 'hidden',
    },
    profileImage: {
      width: '100%',
      height: '100%',
    },
    profilePlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profilePlaceholderText: {
      fontSize: 10,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
  });

  return (
    <View style={styles.previewContainer}>
      {previewUrl ? (
        <>
          <Image
            source={{ uri: previewUrl }}
            style={styles.previewImage}
            contentFit="cover"
          />
          {/* Small profile picture overlay in bottom-left corner */}
          <View style={styles.profileOverlay}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.profileImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profilePlaceholderText}>
                  {userName?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
          </View>
        </>
      ) : (
        // Fallback to profile picture while loading
        <>
          {profilePicture ? (
            <Image
              source={{ uri: profilePicture }}
              style={styles.previewImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.profilePlaceholder}>
              <Text style={styles.profilePlaceholderText}>
                {userName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

export default function StatusStoriesBar({ context, onStatusPress }: StatusStoriesBarProps) {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [statusFeed, setStatusFeed] = useState<StatusFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const styles = StyleSheet.create({
    container: {
      paddingVertical: 12,
      paddingHorizontal: 4,
      backgroundColor: colors.background.primary,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    scrollView: {
      paddingHorizontal: 4,
    },
    bubbleContainer: {
      alignItems: 'center',
      marginHorizontal: BUBBLE_MARGIN,
      width: BUBBLE_SIZE + 16,
    },
    avatarContainer: {
      width: BUBBLE_SIZE,
      height: BUBBLE_SIZE,
      borderRadius: BUBBLE_SIZE / 2,
      borderWidth: 2,
      borderColor: colors.border.light,
      padding: 2,
      marginBottom: 4,
    },
    createButton: {
      borderColor: colors.border.light,
      borderWidth: 2,
    },
    plusIcon: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      borderWidth: 3,
      borderColor: colors.background.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusIconText: {
      color: colors.text.white,
      fontSize: 16,
      fontWeight: '700' as const,
      lineHeight: 18,
    },
    unreadRing: {
      borderWidth: 3,
      borderColor: colors.primary, // Highlighted ring for unviewed
    },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: (BUBBLE_SIZE - 4) / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      fontSize: BUBBLE_SIZE / 2.5,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
    name: {
      fontSize: 11,
      color: colors.text.primary,
      textAlign: 'center',
      maxWidth: BUBBLE_SIZE + 16,
      marginTop: 2,
    },
    yourStoryText: {
      fontWeight: '600' as const,
      color: colors.primary,
    },
    loadingContainer: {
      height: BUBBLE_SIZE + 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyContainer: {
      height: BUBBLE_SIZE + 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: colors.text.tertiary,
    },
    // Card-based styles (for Create Story and Your Story)
    cardContainer: {
      marginHorizontal: CARD_MARGIN,
      width: CARD_WIDTH,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.background.secondary,
    },
    createCard: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    createCardImage: {
      width: '100%',
      height: '100%',
    },
    createCardOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '40%',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    createCardPlus: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -24 }, { translateY: -24 }],
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: colors.background.primary,
    },
    createCardPlusText: {
      color: colors.text.white,
      fontSize: 28,
      fontWeight: '700' as const,
      lineHeight: 32,
    },
    createCardLabel: {
      position: 'absolute',
      bottom: 12,
      left: 0,
      right: 0,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600' as const,
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      console.log(`🔄 [StatusStoriesBar] useEffect triggered for context: ${context}`);
      setLoading(true);
      try {
        const feed = context === 'feed' 
          ? await getStatusFeedForFeed()
          : await getStatusFeedForMessenger();
        
        console.log(`✅ [StatusStoriesBar] Feed loaded in useEffect:`, {
          context,
          feedLength: feed?.length || 0,
          feed: feed,
        });
        
        if (isMounted) {
          setStatusFeed(Array.isArray(feed) ? feed : []);
        }
      } catch (error) {
        console.error('❌ [StatusStoriesBar] Error loading status feed in useEffect:', error);
        if (isMounted) {
          setStatusFeed([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();
    
    // Refresh every 30 seconds to check for new statuses
    const interval = setInterval(() => {
      if (isMounted) {
        loadData();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [context]);

  // Keep loadStatusFeed for manual refreshes (like after viewing a status)
  const loadStatusFeed = async () => {
    console.log(`🔄 [StatusStoriesBar] Manual loadStatusFeed called for context: ${context}`);
    setLoading(true);
    try {
      const feed = context === 'feed' 
        ? await getStatusFeedForFeed()
        : await getStatusFeedForMessenger();
      
      console.log(`✅ [StatusStoriesBar] Feed loaded manually:`, {
        context,
        feedLength: feed?.length || 0,
        feed: feed,
      });
      
      setStatusFeed(Array.isArray(feed) ? feed : []);
    } catch (error) {
      console.error('❌ [StatusStoriesBar] Error loading status feed manually:', error);
      setStatusFeed([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusPress = (statusItem: StatusFeedItem) => {
    if (onStatusPress) {
      onStatusPress(statusItem);
      return;
    }

    // Default behavior: Open status viewer
    router.push(`/status/${statusItem.user_id}` as any);
    
    // Reload feed after viewing
    setTimeout(() => {
      loadStatusFeed();
    }, 1000);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Loading stories...</Text>
        </View>
      </View>
    );
  }

  // Separate current user's status from others
  const ownStatusInFeed = statusFeed.find((item: StatusFeedItem) => item.user_id === currentUser?.id);
  const otherUsersStatuses = statusFeed.filter((item: StatusFeedItem) => item.user_id !== currentUser?.id);

  console.log(`📊 [StatusStoriesBar] Status breakdown:`, {
    totalStatusFeed: statusFeed.length,
    ownStatusInFeed: !!ownStatusInFeed,
    otherUsersCount: otherUsersStatuses.length,
    currentUserId: currentUser?.id,
  });

  // Show other users' statuses (or all if none from other users)
  const statusesToShow = otherUsersStatuses;

  console.log(`🎨 [StatusStoriesBar] Rendering bar:`, {
    totalStatusFeed: statusFeed.length,
    otherUsersCount: otherUsersStatuses.length,
    currentUserId: currentUser?.id,
    willShowBubbles: otherUsersStatuses.length > 0,
  });

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
        bounces={false}
      >
        {/* Create Story Card - Facebook-style card with preview */}
        <TouchableOpacity
          style={styles.cardContainer}
          onPress={() => router.push('/status/create' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.createCard}>
            {/* Background thumbnail - use profile picture or gradient */}
            {currentUser?.profilePicture ? (
              <Image
                source={{ uri: currentUser.profilePicture }}
                style={styles.createCardImage}
                contentFit="cover"
              />
            ) : (
              <LinearGradient
                colors={[colors.primary, colors.primary + 'DD']}
                style={styles.createCardImage}
              />
            )}
            
            {/* Dark overlay for better text readability */}
            <View style={styles.createCardOverlay} />
            
            {/* Large Plus Sign - Centered */}
            <View style={styles.createCardPlus}>
              <Text style={styles.createCardPlusText}>+</Text>
            </View>
            
            {/* "Create story" label at bottom */}
            <Text style={styles.createCardLabel}>Create story</Text>
          </View>
        </TouchableOpacity>

        {/* Your Story Card - Shows preview of your actual status if you have one */}
        {ownStatusInFeed && (
          <YourStoryCard
            statusItem={ownStatusInFeed}
            currentUser={currentUser}
            onPress={() => router.push(`/status/${currentUser?.id}` as any)}
          />
        )}

        {/* Other Users' Statuses */}
        {statusesToShow.map((item: StatusFeedItem) => {
          const hasUnviewed = item.has_unviewed;
          const status = item.latest_status;

          // In Feed: Use card style for all statuses (like Facebook)
          // In Messenger: Use circular bubbles
          if (context === 'feed') {
            return (
              <OtherUserStoryCard
                key={item.user_id}
                statusItem={item}
                hasUnviewed={hasUnviewed}
                onPress={() => handleStatusPress(item)}
              />
            );
          } else {
            // Messenger: Use circular bubbles
            const hasMedia = status?.media_path && (status.content_type === 'image' || status.content_type === 'video');
            return (
              <TouchableOpacity
                key={item.user_id}
                style={styles.bubbleContainer}
                onPress={() => handleStatusPress(item)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.avatarContainer,
                    hasUnviewed && styles.unreadRing,
                  ]}
                >
                  {/* Show story preview (media) if available, otherwise show profile picture */}
                  {hasMedia ? (
                    <StoryPreviewBubble
                      mediaPath={status.media_path!}
                      contentType={status.content_type as 'image' | 'video'}
                      profilePicture={item.user_avatar || null}
                      userName={item.user_name || ''}
                    />
                  ) : (
                    <>
                      {item.user_avatar ? (
                        <Image
                          source={{ uri: item.user_avatar }}
                          style={styles.avatar}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <Text style={styles.avatarPlaceholderText}>
                            {item.user_name?.charAt(0)?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </View>
                <Text
                  style={styles.name}
                  numberOfLines={1}
                >
                  {item.user_name}
                </Text>
              </TouchableOpacity>
            );
          }
        })}
      </ScrollView>
    </View>
  );
}

