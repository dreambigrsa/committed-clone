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
import { getStatusFeedForFeed, getStatusFeedForMessenger, markStatusAsViewed } from '@/lib/status-queries';
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
    loadStatusFeed();
    
    // Refresh every 30 seconds to check for new statuses
    const interval = setInterval(() => {
      loadStatusFeed();
    }, 30000);

    return () => clearInterval(interval);
  }, [context]);

  const loadStatusFeed = async () => {
    setLoading(true);
    try {
      const feed = context === 'feed' 
        ? await getStatusFeedForFeed()
        : await getStatusFeedForMessenger();
      setStatusFeed(feed);
    } catch (error) {
      console.error('Error loading status feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusPress = async (statusItem: StatusFeedItem) => {
    if (onStatusPress) {
      onStatusPress(statusItem);
      return;
    }

    // Default behavior: Open status viewer
    if (statusItem.latest_status) {
      // Mark as viewed when opened
      await markStatusAsViewed(statusItem.latest_status.id);
      
      // Navigate to status viewer
      // You'll need to create this screen: app/status/[userId].tsx
      router.push(`/status/${statusItem.user_id}` as any);
      
      // Reload feed to update unread indicators
      loadStatusFeed();
    }
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

  if (statusFeed.length === 0) {
    return null; // Don't show bar if no statuses
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollView}
        bounces={false}
      >
        {statusFeed.map((item: StatusFeedItem) => {
          const isOwnStory = item.user_id === currentUser?.id;
          const hasUnviewed = item.has_unviewed && !isOwnStory;

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
              </View>
              <Text
                style={[styles.name, isOwnStory && styles.yourStoryText]}
                numberOfLines={1}
              >
                {isOwnStory ? 'Your Story' : item.user_name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

