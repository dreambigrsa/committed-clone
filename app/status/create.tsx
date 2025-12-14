/**
 * Create Status Screen
 * 
 * Allows users to create a new status (text, image, or video)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { X, Image as ImageIcon, Video, Type } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { createStatus } from '@/lib/status-queries';

export default function CreateStatusScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { colors } = useTheme();
  const [content, setContent] = useState<string>('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [contentType, setContentType] = useState<'text' | 'image' | 'video'>('text');
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'friends' | 'followers' | 'only_me'>('friends');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background.primary,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.text.primary,
    },
    cancelButton: {
      padding: 8,
    },
    cancelText: {
      fontSize: 16,
      color: colors.text.secondary,
    },
    postButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: colors.primary,
      borderRadius: 20,
    },
    postButtonDisabled: {
      backgroundColor: colors.background.secondary,
    },
    postButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.white,
    },
    postButtonTextDisabled: {
      color: colors.text.tertiary,
    },
    content: {
      flex: 1,
      padding: 20,
    },
    previewContainer: {
      width: '100%',
      height: 300,
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 20,
      backgroundColor: colors.background.secondary,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewVideo: {
      width: '100%',
      height: '100%',
    },
    previewText: {
      fontSize: 32,
      fontWeight: '600' as const,
      color: colors.text.primary,
      textAlign: 'center',
      padding: 40,
    },
    input: {
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
      padding: 16,
      fontSize: 18,
      color: colors.text.primary,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: 20,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 20,
    },
    mediaButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: colors.background.secondary,
      borderWidth: 2,
      borderColor: colors.border.light,
    },
    mediaButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '15',
    },
    mediaButtonText: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.primary,
    },
    privacySection: {
      marginTop: 20,
      padding: 16,
      backgroundColor: colors.background.secondary,
      borderRadius: 12,
    },
    privacyTitle: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: colors.text.primary,
      marginBottom: 12,
    },
    privacyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border.light,
    },
    privacyOptionLast: {
      borderBottomWidth: 0,
    },
    privacyOptionText: {
      fontSize: 15,
      color: colors.text.primary,
      marginLeft: 12,
      flex: 1,
    },
    privacyOptionSelected: {
      color: colors.primary,
      fontWeight: '600' as const,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border.light,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: colors.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
  });

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16], // Story aspect ratio
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('image');
    }
  };

  const pickVideo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your videos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 15, // 15 seconds max for status
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setContentType('video');
    }
  };

  const handlePost = async () => {
    if (contentType === 'text' && !content.trim()) {
      Alert.alert('Error', 'Please add some text to your status');
      return;
    }

    if (contentType !== 'text' && !mediaUri) {
      Alert.alert('Error', 'Please select an image or video');
      return;
    }

    setIsLoading(true);
    try {
      const status = await createStatus(
        contentType,
        contentType === 'text' ? content : null,
        contentType !== 'text' ? mediaUri : null,
        privacyLevel
      );

      if (status) {
        Alert.alert('Success', 'Your status has been posted!', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        Alert.alert('Error', 'Failed to create status. Please try again.');
      }
    } catch (error: any) {
      console.error('Error creating status:', error);
      Alert.alert('Error', error.message || 'Failed to create status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const canPost = (contentType === 'text' && content.trim()) || (contentType !== 'text' && mediaUri);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Status</Text>
          <TouchableOpacity
            onPress={handlePost}
            style={[styles.postButton, (!canPost || isLoading) && styles.postButtonDisabled]}
            disabled={!canPost || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.text.white} />
            ) : (
              <Text
                style={[
                  styles.postButtonText,
                  (!canPost || isLoading) && styles.postButtonTextDisabled,
                ]}
              >
                Post
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* Content Type Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.mediaButton, contentType === 'text' && styles.mediaButtonActive]}
              onPress={() => {
                setContentType('text');
                setMediaUri(null);
              }}
            >
              <Type size={20} color={contentType === 'text' ? colors.primary : colors.text.secondary} />
              <Text style={styles.mediaButtonText}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaButton, contentType === 'image' && styles.mediaButtonActive]}
              onPress={pickImage}
            >
              <ImageIcon size={20} color={contentType === 'image' ? colors.primary : colors.text.secondary} />
              <Text style={styles.mediaButtonText}>Image</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mediaButton, contentType === 'video' && styles.mediaButtonActive]}
              onPress={pickVideo}
            >
              <Video size={20} color={contentType === 'video' ? colors.primary : colors.text.secondary} />
              <Text style={styles.mediaButtonText}>Video</Text>
            </TouchableOpacity>
          </View>

          {/* Preview */}
          {contentType === 'text' ? (
            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.text.tertiary}
              value={content}
              onChangeText={setContent}
              multiline
              autoFocus
            />
          ) : mediaUri ? (
            <View style={styles.previewContainer}>
              {contentType === 'image' ? (
                <Image source={{ uri: mediaUri }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <Image source={{ uri: mediaUri }} style={styles.previewVideo} contentFit="cover" />
              )}
            </View>
          ) : (
            <View style={styles.previewContainer}>
              <Text style={styles.previewText}>Select an image or video</Text>
            </View>
          )}

          {/* Privacy Settings */}
          <View style={styles.privacySection}>
            <Text style={styles.privacyTitle}>Who can see this?</Text>
            {(['public', 'friends', 'followers', 'only_me'] as const).map((option, index) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.privacyOption,
                  index === 3 && styles.privacyOptionLast,
                ]}
                onPress={() => setPrivacyLevel(option)}
              >
                <View style={styles.radioButton}>
                  {privacyLevel === option && <View style={styles.radioButtonInner} />}
                </View>
                <Text
                  style={[
                    styles.privacyOptionText,
                    privacyLevel === option && styles.privacyOptionSelected,
                  ]}
                >
                  {option === 'public' && 'Public'}
                  {option === 'friends' && 'Friends'}
                  {option === 'followers' && 'Followers'}
                  {option === 'only_me' && 'Only Me'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}




