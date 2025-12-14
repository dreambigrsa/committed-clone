/**
 * Status Viewer Screen
 * 
 * Full-screen status viewer (like Instagram Stories)
 * Shows all statuses from a user in sequence
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Trash2, Plus, Music, Type, Image as ImageIcon, RefreshCw, Share2, MoreHorizontal, Globe } from 'lucide-react-native';
import { getUserStatuses, markStatusAsViewed, getSignedUrlForMedia, deleteStatus, getStatusViewers, getStatusViewCount, type StatusViewer } from '@/lib/status-queries';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { Status } from '@/lib/status-queries';

const { width, height } = Dimensions.get('window');
const PROGRESS_BAR_HEIGHT = 3;

export default function StatusViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useApp();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [viewCount, setViewCount] = useState<number>(0);
  const [viewers, setViewers] = useState<StatusViewer[]>([]);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    progressContainer: {
      flexDirection: 'row',
      paddingHorizontal: 4,
      paddingTop: 8,
      gap: 4,
      height: PROGRESS_BAR_HEIGHT + 8,
    },
    progressBarWrapper: {
      flex: 1,
      height: PROGRESS_BAR_HEIGHT,
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      borderRadius: PROGRESS_BAR_HEIGHT / 2,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#fff',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      paddingTop: 16,
    },
    userInfo: {
      flex: 1,
    },
    userInfoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    profilePicture: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    profilePlaceholder: {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profilePlaceholderText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600' as const,
    },
    userName: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600' as const,
    },
    timestampRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 2,
    },
    timestamp: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 12,
    },
    viewCountButton: {
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    viewCountText: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 12,
      fontWeight: '500' as const,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    textContent: {
      color: '#fff',
      fontSize: 24,
      textAlign: 'center',
      fontWeight: '500' as const,
    },
    media: {
      width: width,
      height: height * 0.7,
    },
    loadingText: {
      color: '#fff',
      fontSize: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    navArea: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: width / 3,
    },
    leftArea: {
      left: 0,
    },
    rightArea: {
      right: 0,
    },
    bottomBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 12,
      paddingBottom: 20,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      gap: 8,
    },
    quickReactions: {
      flexDirection: 'row',
      gap: 4,
    },
    quickReactionEmoji: {
      fontSize: 20,
    },
    messageInputContainer: {
      flex: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 50,
    },
    messageInput: {
      color: '#fff',
      fontSize: 14,
      padding: 0,
    },
    reactionButtons: {
      flexDirection: 'row',
      gap: 8,
    },
    reactionButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactionEmoji: {
      fontSize: 22,
    },
    plusButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusMenuOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    plusMenuBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    plusMenu: {
      position: 'absolute',
      bottom: 80,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 8,
      paddingBottom: 20,
    },
    plusMenuOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 16,
    },
    plusMenuIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusMenuText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '500' as const,
    },
  });

  useEffect(() => {
    if (!userId || userId === 'undefined') {
      router.back();
      return;
    }

    loadStatuses();
  }, [userId]);

  useEffect(() => {
    if (statuses.length > 0 && currentIndex < statuses.length) {
      loadMedia();
      startProgress();
      markAsViewed();
      loadViewCount();
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, statuses]);

  const loadViewCount = async () => {
    const status = statuses[currentIndex];
    if (!status || currentUser?.id !== status.user_id) {
      setViewCount(0);
      return;
    }

    try {
      const count = await getStatusViewCount(status.id);
      setViewCount(count);
    } catch (error) {
      console.error('Error loading view count:', error);
    }
  };

  const loadViewers = async () => {
    const status = statuses[currentIndex];
    if (!status || currentUser?.id !== status.user_id) {
      return;
    }

    setLoadingViewers(true);
    try {
      const viewerList = await getStatusViewers(status.id);
      setViewers(viewerList);
    } catch (error) {
      console.error('Error loading viewers:', error);
    } finally {
      setLoadingViewers(false);
    }
  };

  const handleViewersPress = async () => {
    await loadViewers();
    setShowViewers(true);
  };

  const loadStatuses = async () => {
    if (!userId || userId === 'undefined' || userId === 'null') {
      console.error('❌ [StatusViewer] Invalid userId:', userId);
      router.back();
      return;
    }

    console.log('🔍 [StatusViewer] Loading statuses for userId:', userId);
    setIsLoading(true);
    
    try {
      const userStatuses = await getUserStatuses(userId);
      console.log('📊 [StatusViewer] Received statuses:', {
        count: userStatuses.length,
        statuses: userStatuses.map(s => ({
          id: s.id?.substring(0, 8) + '...',
          content_type: s.content_type,
        })),
      });
      
      if (userStatuses.length === 0) {
        console.warn('⚠️ [StatusViewer] No statuses found for user:', userId);
        Alert.alert('No Statuses', 'This user has no active statuses.');
        router.back();
        return;
      }
      
      setStatuses(userStatuses);
      setCurrentIndex(0);
    } catch (error) {
      console.error('❌ [StatusViewer] Error loading statuses:', error);
      Alert.alert('Error', 'Failed to load statuses. Please try again.');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMedia = async () => {
    const status = statuses[currentIndex];
    if (!status || !status.media_path) {
      setMediaUrl(null);
      return;
    }

    try {
      const url = await getSignedUrlForMedia(status.media_path);
      setMediaUrl(url);
    } catch (error) {
      console.error('Error loading media:', error);
      setMediaUrl(null);
    }
  };

  const markAsViewed = async () => {
    const status = statuses[currentIndex];
    if (!status) return;

    await markStatusAsViewed(status.id);
  };

  const startProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    progressAnim.setValue(0);
    const duration = 5000; // 5 seconds per status
    const steps = 100;
    const stepDuration = duration / steps;
    let currentStep = 0;

    progressInterval.current = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      progressAnim.setValue(progress);

      if (progress >= 1) {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
        handleNext();
      }
    }, stepDuration);
  };

  const handleNext = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      router.back();
    }
  };

  const handlePrev = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleClose = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    router.back();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      // TODO: Implement send message to status
      console.log('Sending message:', messageText);
      setMessageText('');
      // You can navigate to conversation or show a toast
    }
  };

  const handleReaction = (reaction: string) => {
    // TODO: Implement reaction
    console.log('Reaction:', reaction);
  };

  const handleDelete = async () => {
    const status = statuses[currentIndex];
    if (!status) return;

    const isOwnStatus = currentUser?.id === status.user_id;

    if (!isOwnStatus) {
      Alert.alert('Error', 'You can only delete your own statuses.');
      return;
    }

    Alert.alert(
      'Delete Status',
      'Are you sure you want to delete this status?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const success = await deleteStatus(status.id);
              if (success) {
                const newStatuses = statuses.filter((s) => s.id !== status.id);
                setStatuses(newStatuses);

                if (newStatuses.length === 0) {
                  router.back();
                } else {
                  const newIndex = currentIndex >= newStatuses.length 
                    ? newStatuses.length - 1 
                    : currentIndex;
                  setCurrentIndex(newIndex);
                }
              } else {
                Alert.alert('Error', 'Failed to delete status. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting status:', error);
              Alert.alert('Error', 'Failed to delete status. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading || statuses.length === 0) {
    return (
      <Modal visible={true} animationType="fade">
        <View style={[styles.container, { backgroundColor: '#000' }]}>
          <StatusBar barStyle="light-content" />
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </View>
      </Modal>
    );
  }

  const status = statuses[currentIndex];

  return (
    <Modal visible={true} animationType="fade" onRequestClose={handleClose}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {statuses.map((_, index) => (
            <View key={index} style={styles.progressBarWrapper}>
              {index === currentIndex ? (
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              ) : index < currentIndex ? (
                <View style={[styles.progressBarFill, { width: '100%' }]} />
              ) : null}
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <View style={styles.userInfoRow}>
              {status.user?.profile_picture ? (
                <Image
                  source={{ uri: status.user.profile_picture }}
                  style={styles.profilePicture}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.profilePicture, styles.profilePlaceholder]}>
                  <Text style={styles.profilePlaceholderText}>
                    {(status.user?.full_name || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>
                  {status.user?.full_name || 'User'}
                </Text>
                <View style={styles.timestampRow}>
                  <Text style={styles.timestamp}>
                    {formatTimeAgo(status.created_at)}
                  </Text>
                  {/* Show view count for own statuses */}
                  {currentUser?.id === status.user_id && viewCount > 0 && (
                    <TouchableOpacity 
                      style={styles.viewCountButton}
                      onPress={handleViewersPress}
                    >
                      <Text style={styles.viewCountText}>
                        {viewCount} {viewCount === 1 ? 'viewer' : 'viewers'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Delete button - only show for own statuses */}
            {currentUser?.id === status.user_id && (
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Trash2 size={20} color="#fff" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {status.content_type === 'text' ? (
            <Text style={styles.textContent}>{status.text_content}</Text>
          ) : status.content_type === 'image' && mediaUrl ? (
            <Image source={{ uri: mediaUrl }} style={styles.media} contentFit="contain" />
          ) : status.content_type === 'video' && mediaUrl ? (
            <Video
              source={{ uri: mediaUrl }}
              style={styles.media}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          ) : (
            <Text style={styles.loadingText}>Loading media...</Text>
          )}
        </View>

        {/* Navigation Areas */}
        <TouchableOpacity
          style={[styles.navArea, styles.leftArea]}
          onPress={handlePrev}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={[styles.navArea, styles.rightArea]}
          onPress={handleNext}
          activeOpacity={1}
        />

        {/* Bottom Interaction Bar */}
        <View style={styles.bottomBar}>
          {/* Quick Reactions (small emojis) */}
          <View style={styles.quickReactions}>
            <TouchableOpacity onPress={() => handleReaction('heart-eyes')}>
              <Text style={styles.quickReactionEmoji}>😍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleReaction('heart-eyes')}>
              <Text style={styles.quickReactionEmoji}>😍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleReaction('heart-eyes')}>
              <Text style={styles.quickReactionEmoji}>😍</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleReaction('heart')}>
              <Text style={styles.quickReactionEmoji}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleReaction('wink')}>
              <Text style={styles.quickReactionEmoji}>😉</Text>
            </TouchableOpacity>
          </View>

          {/* Send Message Input */}
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Send message..."
              placeholderTextColor="rgba(255, 255, 255, 0.5)"
              value={messageText}
              onChangeText={setMessageText}
              onSubmitEditing={handleSendMessage}
              multiline={false}
            />
          </View>

          {/* Reaction Buttons */}
          <View style={styles.reactionButtons}>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleReaction('heart')}
            >
              <Text style={styles.reactionEmoji}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleReaction('like')}
            >
              <Text style={styles.reactionEmoji}>👍</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.reactionButton}
              onPress={() => handleReaction('laugh')}
            >
              <Text style={styles.reactionEmoji}>😂</Text>
            </TouchableOpacity>
          </View>

          {/* Plus Icon */}
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() => setShowPlusMenu(!showPlusMenu)}
          >
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Plus Menu Modal */}
        {showPlusMenu && (
          <View style={styles.plusMenuOverlay}>
            <TouchableOpacity
              style={styles.plusMenuBackdrop}
              onPress={() => setShowPlusMenu(false)}
              activeOpacity={1}
            />
            <View style={styles.plusMenu}>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  router.push('/status/create' as any);
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <Plus size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Create story</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  // TODO: Navigate to create with music
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <Music size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Create with music</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  // TODO: Navigate to Imagine
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <ImageIcon size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Imagine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  // TODO: Implement reshare
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <RefreshCw size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Reshare story</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.plusMenuOption}
                onPress={() => {
                  setShowPlusMenu(false);
                  // TODO: Implement share
                }}
              >
                <View style={styles.plusMenuIcon}>
                  <Share2 size={24} color="#fff" />
                </View>
                <Text style={styles.plusMenuText}>Share story</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

