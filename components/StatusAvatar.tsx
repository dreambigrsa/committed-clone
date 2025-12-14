/**
 * StatusAvatar Component
 * 
 * Avatar with green circle outline when user has an active status
 * Clicking opens their status viewer (like Facebook/Messenger)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { getUserStatuses } from '@/lib/status-queries';

interface StatusAvatarProps {
  /**
   * User ID to check for status
   */
  userId: string;
  /**
   * Avatar image URL
   */
  avatarUrl?: string | null;
  /**
   * User's name (for placeholder)
   */
  userName: string;
  /**
   * Size of the avatar
   */
  size?: number;
  /**
   * Whether user has an active status (will be checked if not provided)
   */
  hasStatus?: boolean;
  /**
   * Whether this is the current user's avatar
   */
  isOwn?: boolean;
  /**
   * Custom onPress handler (overrides default status viewer)
   */
  onPress?: () => void;
  /**
   * Whether to show status ring (default: true)
   */
  showStatusRing?: boolean;
  /**
   * Additional touchable opacity props
   */
  touchableProps?: Omit<TouchableOpacityProps, 'onPress' | 'children'>;
}

export default function StatusAvatar({
  userId,
  avatarUrl,
  userName,
  size = 44,
  hasStatus: hasStatusProp,
  isOwn = false,
  onPress: customOnPress,
  showStatusRing = true,
  touchableProps,
}: StatusAvatarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [hasStatus, setHasStatus] = React.useState(hasStatusProp ?? false);
  const [isChecking, setIsChecking] = React.useState(!hasStatusProp);

  React.useEffect(() => {
    // Only check if not provided as prop and not own profile
    if (hasStatusProp !== undefined || isOwn || !showStatusRing) {
      setHasStatus(hasStatusProp ?? false);
      setIsChecking(false);
      return;
    }

    // Validate userId before checking status
    if (!userId || userId === 'undefined' || userId === 'null' || userId === '' || typeof userId !== 'string') {
      setHasStatus(false);
      setIsChecking(false);
      return;
    }

    // Check if user has active status
    const checkStatus = async () => {
      try {
        // Double-check userId is valid before calling
        if (!userId || userId === 'undefined' || userId === 'null' || userId === '') {
          setHasStatus(false);
          return;
        }
        const statuses = await getUserStatuses(userId);
        setHasStatus(statuses.length > 0);
      } catch (error) {
        console.error('Error checking user status:', error);
        setHasStatus(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkStatus();

    // Refresh check every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [userId, hasStatusProp, isOwn, showStatusRing]);

  const handlePress = async () => {
    if (customOnPress) {
      customOnPress();
      return;
    }

    // If user has status, open status viewer
    // Validate userId before navigating
    if (hasStatus && !isOwn && userId && userId !== 'undefined' && userId !== 'null' && userId !== '') {
      router.push(`/status/${userId}` as any);
    }
  };

  const styles = StyleSheet.create({
    container: {
      position: 'relative',
      width: size,
      height: size,
    },
    avatarContainer: {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: showStatusRing && hasStatus ? 3 : 2,
      borderColor: showStatusRing && hasStatus 
        ? '#25D366' // Green color for status (WhatsApp/Facebook style)
        : colors.border.light,
      padding: showStatusRing && hasStatus ? 1.5 : 2,
    },
    avatar: {
      width: '100%',
      height: '100%',
      borderRadius: (size - (showStatusRing && hasStatus ? 6 : 4)) / 2,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: (size - (showStatusRing && hasStatus ? 6 : 4)) / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarPlaceholderText: {
      fontSize: size / 2.5,
      fontWeight: '700' as const,
      color: colors.text.white,
    },
  });

  const content = (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>
              {userName?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Only make clickable if user has status or custom onPress provided
  if (hasStatus || customOnPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        disabled={isChecking}
        {...touchableProps}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View {...touchableProps}>{content}</View>;
}

