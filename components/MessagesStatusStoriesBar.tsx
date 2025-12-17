import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Plus, Play, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StatusItem {
  userId: string;
  userName: string;
  userAvatar: string | null;
  hasUnviewed: boolean;
  latestStatus: {
    id: string;
    mediaPath: string | null;
    contentType: 'text' | 'image' | 'video';
  } | null;
}

interface MessagesStatusStoriesBarProps {
  // Messages-specific status stories bar
}

export default function MessagesStatusStoriesBar({}: MessagesStatusStoriesBarProps) {
  const { colors } = useTheme();
  const { currentUser, conversations } = useApp();
  const router = useRouter();
  // This component is specifically for messages screen
  const [statusFeed, setStatusFeed] = useState<StatusItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingStatus, setViewingStatus] = useState<StatusItem | null>(null);
  const [statusMediaUrl, setStatusMediaUrl] = useState<string | null>(null);

  const styles = createStyles(colors);

  useEffect(() => {
    loadStatusFeed();
    
    // Refresh feed every 30 seconds to remove expired statuses
    const refreshInterval = setInterval(() => {
      loadStatusFeed();
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [currentUser, conversations]);

  const loadStatusFeed = async () => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Get friends and recent chat participants
      const participantIds = new Set<string>();
      conversations.forEach(conv => {
        conv.participants.forEach((id: string) => {
          if (id !== currentUser.id) {
            participantIds.add(id);
          }
        });
      });

      // Fetch statuses for friends and chat participants
      const { data: statuses, error } = await supabase
        .from('statuses')
        .select(`
          id,
          user_id,
          content_type,
          media_path,
          created_at,
          users!statuses_user_id_fkey(full_name, profile_picture)
        `)
        .eq('archived', false)
        .gt('expires_at', new Date().toISOString())
        .in('user_id', Array.from(participantIds))
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Check which statuses have been viewed
      const statusIds = statuses?.map(s => s.id) || [];
      let viewedStatusIds: string[] = [];
      
      if (statusIds.length > 0) {
        const { data: views } = await supabase
          .from('status_views')
          .select('status_id')
          .eq('viewer_id', currentUser.id)
          .in('status_id', statusIds);
        
        viewedStatusIds = views?.map(v => v.status_id) || [];
      }

      // Group by user and get latest status
      const statusMap = new Map<string, StatusItem>();
      
      // Add current user's status first
      const { data: myStatus } = await supabase
        .from('statuses')
        .select(`
          id,
          content_type,
          media_path,
          created_at
        `)
        .eq('user_id', currentUser.id)
        .eq('archived', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (myStatus) {
        statusMap.set(currentUser.id, {
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.profilePicture || null,
          hasUnviewed: false, // Your own status is always viewed
          latestStatus: {
            id: myStatus.id,
            mediaPath: myStatus.media_path,
            contentType: myStatus.content_type as 'text' | 'image' | 'video',
          },
        });
      } else {
        // Add "Your story" placeholder even if no status exists
        statusMap.set(currentUser.id, {
          userId: currentUser.id,
          userName: currentUser.fullName,
          userAvatar: currentUser.profilePicture || null,
          hasUnviewed: false,
          latestStatus: null,
        });
      }

      // Add other users' statuses
      statuses?.forEach((status: any) => {
        const userId = status.user_id;
        if (userId === currentUser.id) return; // Skip current user (already added)

        const user = status.users;
        const hasUnviewed = !viewedStatusIds.includes(status.id);
        
        const existing = statusMap.get(userId);
        // Only add if no existing status or this one is newer
        if (!existing || !existing.latestStatus || new Date(status.created_at) > new Date(existing.latestStatus.id)) {
          statusMap.set(userId, {
            userId,
            userName: user?.full_name || 'Unknown',
            userAvatar: (user?.profile_picture as string | null) || null,
            hasUnviewed,
            latestStatus: {
              id: status.id,
              mediaPath: status.media_path,
              contentType: status.content_type as 'text' | 'image' | 'video',
            },
          });
        } else if (existing && existing.latestStatus && existing.latestStatus.id === status.id) {
          // Update unviewed status if it's the same status
          existing.hasUnviewed = hasUnviewed;
        }
      });

      // Convert to array, ensuring current user is first
      // Filter out users with no status (except current user who should always show)
      const feedArray = Array.from(statusMap.values())
        .filter(item => {
          // Always show current user (for "Your story")
          if (item.userId === currentUser.id) return true;
          // Only show others if they have an active status
          return item.latestStatus !== null;
        })
        .sort((a, b) => {
          if (a.userId === currentUser.id) return -1;
          if (b.userId === currentUser.id) return 1;
          // Sort by unviewed first, then by name
          if (a.hasUnviewed && !b.hasUnviewed) return -1;
          if (!a.hasUnviewed && b.hasUnviewed) return 1;
          return a.userName.localeCompare(b.userName);
        });

      setStatusFeed(feedArray);
    } catch (error) {
      console.error('Load status feed error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStatus = async () => {
    if (!currentUser) return;

    try {
      setIsCreating(true);

      // Request permissions
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'You need to allow access to your photos to create a status.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [9, 16], // Story aspect ratio
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      
      // Upload image to Supabase storage
      const fileName = `status/${currentUser.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('status-media')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create status record
      const { error: statusError } = await supabase
        .from('statuses')
        .insert({
          user_id: currentUser.id,
          content_type: 'image',
          media_path: fileName,
          privacy_level: 'friends', // Default to friends
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        });

      if (statusError) throw statusError;

      // Reload feed
      await loadStatusFeed();
      
      Alert.alert('Success', 'Your status has been created!');
    } catch (error: any) {
      console.error('Create status error:', error);
      Alert.alert('Error', error?.message || 'Failed to create status. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusPress = async (item: StatusItem) => {
    if (item.userId === currentUser?.id) {
      if (!item.latestStatus) {
        // Create new status
        await handleCreateStatus();
      } else {
        // View your own status
        await openStatusViewer(item);
      }
    } else {
      // View other user's status
      if (item.latestStatus) {
        await openStatusViewer(item);
      }
    }
  };

  const openStatusViewer = async (item: StatusItem) => {
    if (!item.latestStatus) return;

    try {
      // Get media URL from storage
      if (item.latestStatus.mediaPath) {
        const { data } = supabase.storage
          .from('status-media')
          .getPublicUrl(item.latestStatus.mediaPath);
        setStatusMediaUrl(data.publicUrl);
      }

      setViewingStatus(item);

      // Mark as viewed if not current user
      if (item.userId !== currentUser?.id) {
        try {
          const { error: viewError } = await supabase
            .from('status_views')
            .insert({
              status_id: item.latestStatus.id,
              viewer_id: currentUser?.id,
            });

          if (viewError && !viewError.message.includes('duplicate')) {
            console.error('Error marking status as viewed:', viewError);
          } else {
            // Immediately update the feed to change ring from green to gray
            setStatusFeed(prevFeed => 
              prevFeed.map(feedItem => 
                feedItem.userId === item.userId && 
                feedItem.latestStatus && 
                item.latestStatus &&
                feedItem.latestStatus.id === item.latestStatus.id
                  ? { ...feedItem, hasUnviewed: false }
                  : feedItem
              )
            );
          }
        } catch (error) {
          console.error('Error marking status as viewed:', error);
        }
      }
    } catch (error) {
      console.error('Error opening status viewer:', error);
      Alert.alert('Error', 'Failed to load status');
    }
  };

  const closeStatusViewer = () => {
    setViewingStatus(null);
    setStatusMediaUrl(null);
    // Refresh feed to ensure expired statuses are removed and rings update
    loadStatusFeed();
  };

  if (isLoading && statusFeed.length === 0) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (statusFeed.length === 0 && !currentUser) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {statusFeed.map((item) => {
          const isCurrentUser = item.userId === currentUser?.id;
          const hasStatus = item.latestStatus !== null;

          return (
            <TouchableOpacity
              key={item.userId}
              style={styles.storyBubble}
              onPress={() => handleStatusPress(item)}
              disabled={isCreating}
            >
              <View
                style={[
                  styles.avatarContainer,
                  // Only show ring if status exists
                  hasStatus && item.hasUnviewed && styles.unreadRing, // Green for unviewed
                  hasStatus && !item.hasUnviewed && styles.viewedRing, // Gray for viewed
                  // No ring if no status (even for current user)
                  !hasStatus && styles.createRing,
                ]}
              >
                {item.userAvatar ? (
                  <Image
                    source={{ uri: item.userAvatar }}
                    style={styles.avatar}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarPlaceholderText}>
                      {item.userName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                {isCurrentUser && !hasStatus && (
                  <View style={styles.plusIconContainer}>
                    <Plus size={20} color={colors.text.white} strokeWidth={3} />
                  </View>
                )}
                {hasStatus && item.latestStatus?.contentType === 'video' && (
                  <View style={styles.playIconContainer}>
                    <Play size={12} color={colors.text.white} fill={colors.text.white} />
                  </View>
                )}
              </View>
              <Text style={styles.storyName} numberOfLines={1}>
                {isCurrentUser ? 'Your story' : item.userName}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Status Viewer Modal */}
      <Modal
        visible={viewingStatus !== null}
        transparent
        animationType="fade"
        onRequestClose={closeStatusViewer}
      >
        <View style={styles.statusViewerContainer}>
          <TouchableOpacity
            style={styles.statusViewerClose}
            onPress={closeStatusViewer}
          >
            <X size={28} color={colors.text.white} />
          </TouchableOpacity>

          {viewingStatus && statusMediaUrl && (
            <View style={styles.statusViewerContent}>
              <Image
                source={{ uri: statusMediaUrl }}
                style={styles.statusViewerImage}
                contentFit="contain"
              />
              <View style={styles.statusViewerInfo}>
                <Text style={styles.statusViewerName}>
                  {viewingStatus.userId === currentUser?.id ? 'Your story' : viewingStatus.userName}
                </Text>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
    minHeight: 90, // Ensure consistent height
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  storyBubble: {
    alignItems: 'center',
    width: 70,
    marginRight: 4,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 0, // No default border - only show when status exists
    borderColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  unreadRing: {
    // Facebook-style green ring for unviewed status
    borderColor: colors.secondary || '#34A853', // Use committed secondary color (green)
    borderWidth: 3,
  },
  viewedRing: {
    // Gray ring for viewed status (Facebook style)
    borderColor: colors.border.medium || '#8E8E93', // Gray for viewed
    borderWidth: 2.5,
  },
  createRing: {
    // No ring for "Your story" when no status exists
    borderColor: 'transparent',
    borderWidth: 0,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  plusIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2.5,
    borderColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  playIconContainer: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyName: {
    fontSize: 12,
    color: colors.text.primary,
    marginTop: 6,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  statusViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  statusViewerContent: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusViewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.8,
  },
  statusViewerInfo: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
  },
  statusViewerName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
});

