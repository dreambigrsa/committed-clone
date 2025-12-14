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
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import { getUserStatuses, markStatusAsViewed, getStatusMediaUrl } from '@/lib/status-queries';
import { useTheme } from '@/contexts/ThemeContext';
import type { Status } from '@/lib/status-queries';

const { width, height } = Dimensions.get('window');
const PROGRESS_BAR_HEIGHT = 3;

export default function StatusViewerScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // Define styles at the top to avoid "used before declaration" errors
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    progressContainer: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingTop: 8,
      gap: 4,
    },
    progressBarWrapper: {
      flex: 1,
      height: PROGRESS_BAR_HEIGHT,
      backgroundColor: 'rgba(255,255,255,0.3)',
      borderRadius: PROGRESS_BAR_HEIGHT / 2,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      backgroundColor: '#fff',
      borderRadius: PROGRESS_BAR_HEIGHT / 2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    userInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    userAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      marginRight: 8,
    },
    userName: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '600' as const,
    },
    timestamp: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: 12,
      marginLeft: 8,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 20,
    },
    textContent: {
      color: '#fff',
      fontSize: 28,
      fontWeight: '600' as const,
      textAlign: 'center',
    },
    media: {
      width: width,
      height: height * 0.7,
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: '#fff',
      fontSize: 16,
    },
  });

  useEffect(() => {
    loadStatuses();
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [userId]);

  useEffect(() => {
    if (statuses.length > 0 && currentIndex < statuses.length) {
      loadMediaUrl();
      markAsViewed();
      startProgress();
    }
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex, statuses]);

  const loadStatuses = async () => {
    // Validate userId before making the request
    if (!userId || userId === 'undefined' || userId === 'null' || typeof userId !== 'string') {
      console.error('Invalid userId in StatusViewer:', userId);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const userStatuses = await getUserStatuses(userId);
      setStatuses(userStatuses);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Error loading statuses:', error);
      setStatuses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMediaUrl = async () => {
    const status = statuses[currentIndex];
    if (status?.media_path) {
      try {
        const url = await getStatusMediaUrl(status.media_path);
        setMediaUrl(url);
      } catch (error) {
        console.error('Error loading media URL:', error);
        setMediaUrl(null);
      }
    } else {
      setMediaUrl(null);
    }
  };

  const markAsViewed = async () => {
    if (statuses[currentIndex]) {
      try {
        await markStatusAsViewed(statuses[currentIndex].id);
      } catch (error) {
        console.error('Error marking as viewed:', error);
      }
    }
  };

  const startProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    progressAnim.setValue(0);
    const duration = 5000; // 5 seconds per status
    const startTime = Date.now();
    
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      progressAnim.setValue(progress);
      
      if (progress >= 1) {
        handleNext();
      }
    }, 50);
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
            <Text style={styles.userName}>
              {status.user?.full_name || 'User'}
            </Text>
            <Text style={styles.timestamp}>
              {new Date(status.created_at).toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
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
      </View>
    </Modal>
  );
}


