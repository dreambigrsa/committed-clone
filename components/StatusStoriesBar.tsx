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
const BUBBLE_SIZE = 64;
const BUBBLE_MARGIN = 8;

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
        {/* Your Story Button - Shows your status if you have one, otherwise shows create */}
        {ownStatusInFeed ? (
          // You have statuses - show your story bubble (clickable to view)
          <TouchableOpacity
            style={styles.bubbleContainer}
            onPress={() => router.push(`/status/${currentUser?.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarContainer}>
              {ownStatusInFeed.user_avatar ? (
                <Image
                  source={{ uri: ownStatusInFeed.user_avatar }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : currentUser?.profilePicture ? (
                <Image
                  source={{ uri: currentUser.profilePicture }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {currentUser?.fullName?.charAt(0)?.toUpperCase() || '+'}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.name, styles.yourStoryText]}>Your Story</Text>
          </TouchableOpacity>
        ) : (
          // No statuses - show create button
          <TouchableOpacity
            style={styles.bubbleContainer}
            onPress={() => router.push('/status/create' as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatarContainer, styles.createButton]}>
              {currentUser?.profilePicture ? (
                <Image
                  source={{ uri: currentUser.profilePicture }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarPlaceholderText}>
                    {currentUser?.fullName?.charAt(0)?.toUpperCase() || '+'}
                  </Text>
                </View>
              )}
              <View style={styles.plusIcon}>
                <Text style={styles.plusIconText}>+</Text>
              </View>
            </View>
            <Text style={[styles.name, styles.yourStoryText]}>Your Story</Text>
          </TouchableOpacity>
        )}

        {/* Other Users' Statuses (or all statuses if debugging) */}
        {statusesToShow.map((item: StatusFeedItem) => {
          const hasUnviewed = item.has_unviewed;
          const status = item.latest_status;
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
        })}
      </ScrollView>
    </View>
  );
}

