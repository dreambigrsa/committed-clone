/**
 * Create Status Screen
 * 
 * Allows users to create text, image, or video statuses
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { createStatus } from '@/lib/status-queries';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { Video, ResizeMode } from 'expo-av';
import { X, Camera, Image as ImageIcon } from 'lucide-react-native';

export default function CreateStatusScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [textContent, setTextContent] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [isPosting, setIsPosting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your photos to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('image');
    }
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'We need access to your videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 15, // 15 seconds max
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('video');
    }
  };

  const handlePost = async () => {
    if (contentType === 'text' && !textContent.trim()) {
      Alert.alert('Required', 'Please enter some text for your status.');
      return;
    }

    if (contentType !== 'text' && !mediaUri) {
      Alert.alert('Required', 'Please select an image or video.');
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
        Alert.alert('Success', 'Status posted!', [
          { text: 'OK', onPress: () => router.back() },
        ]);
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text.primary,
    },
    postButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 20,
      opacity: isPosting ? 0.5 : 1,
    },
    postButtonText: {
      color: colors.text.white,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      padding: 16,
    },
    textInput: {
      minHeight: 200,
      fontSize: 16,
      color: colors.text.primary,
      textAlignVertical: 'top',
    },
    mediaContainer: {
      marginTop: 16,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.background.secondary,
    },
    media: {
      width: '100%',
      height: 400,
    },
    mediaRemove: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderRadius: 20,
      padding: 8,
    },
    actions: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 12,
      borderRadius: 8,
      backgroundColor: colors.background.secondary,
      gap: 8,
    },
    actionButtonText: {
      color: colors.text.primary,
      fontWeight: '500',
    },
    privacySection: {
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    privacyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text.primary,
      marginBottom: 12,
    },
    privacyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      marginBottom: 8,
      backgroundColor: privacyLevel === 'public' ? colors.primary + '20' : 'transparent',
    },
    privacyOptionText: {
      fontSize: 14,
      color: colors.text.primary,
      marginLeft: 12,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <X size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Status</Text>
        <TouchableOpacity
          style={styles.postButton}
          onPress={handlePost}
          disabled={isPosting}
        >
          {isPosting ? (
            <ActivityIndicator size="small" color={colors.text.white} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {contentType === 'text' && (
          <TextInput
            style={styles.textInput}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.text.tertiary}
            value={textContent}
            onChangeText={setTextContent}
            multiline
            autoFocus
          />
        )}

        {mediaUri && (
          <View style={styles.mediaContainer}>
            {contentType === 'image' ? (
              <Image source={{ uri: mediaUri }} style={styles.media} contentFit="cover" />
            ) : (
              <Video source={{ uri: mediaUri }} style={styles.media} resizeMode={ResizeMode.COVER} />
            )}
            <TouchableOpacity
              style={styles.mediaRemove}
              onPress={() => {
                setMediaUri(null);
                setContentType('text');
              }}
            >
              <X size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
            <ImageIcon size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={pickVideo}>
            <Camera size={20} color={colors.text.primary} />
            <Text style={styles.actionButtonText}>Video</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.privacySection}>
          <Text style={styles.privacyTitle}>Privacy</Text>
          {(['public', 'friends', 'followers', 'only_me'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.privacyOption,
                privacyLevel === level && { backgroundColor: colors.primary + '20' },
              ]}
              onPress={() => setPrivacyLevel(level)}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: privacyLevel === level ? colors.primary : colors.border.light,
                  backgroundColor: privacyLevel === level ? colors.primary : 'transparent',
                }}
              />
              <Text style={styles.privacyOptionText}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

