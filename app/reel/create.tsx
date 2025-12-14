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
import { X, Video as VideoIcon, Upload } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode } from 'expo-av';
import { supabase } from '@/lib/supabase';

export default function CreateReelScreen() {
  const router = useRouter();
  const { createReel } = useApp();
  const [caption, setCaption] = useState<string>('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const pickVideo = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your videos to upload reels.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to record videos.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const uploadVideo = async (uri: string): Promise<string> => {
    const fileName = `reel_${Date.now()}_${Math.random().toString(36).substring(7)}.mp4`;
    
    // Convert URI to Uint8Array using legacy API (no deprecation warnings)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const uint8Array = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    const { error } = await supabase.storage
      .from('media')
      .upload(fileName, uint8Array, {
        contentType: 'video/mp4',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handlePost = async () => {
    if (!videoUri) {
      Alert.alert('Error', 'Please select or record a video');
      return;
    }

    setIsUploading(true);
    try {
      const uploadedVideoUrl = await uploadVideo(videoUri);
      
      await createReel(uploadedVideoUrl, caption.trim());
      
      Alert.alert('Success', 'Reel posted successfully!');
      router.back();
    } catch (error) {
      console.error('Failed to upload reel:', error);
      Alert.alert('Error', 'Failed to upload reel. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeVideo = () => {
    setVideoUri(null);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Create Reel',
          presentation: 'modal',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={handlePost}
              disabled={isUploading || !videoUri}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.postButton,
                    !videoUri && styles.postButtonDisabled,
                  ]}
                >
                  Post
                </Text>
              )}
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {videoUri ? (
              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: videoUri }}
                  style={styles.videoPreview}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={removeVideo}
                >
                  <X size={20} color={colors.text.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadContainer}>
                <VideoIcon size={64} color={colors.text.tertiary} strokeWidth={1.5} />
                <Text style={styles.uploadTitle}>Upload a Reel</Text>
                <Text style={styles.uploadSubtitle}>
                  Videos up to 60 seconds
                </Text>

                <View style={styles.uploadButtons}>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={recordVideo}
                    >
                      <VideoIcon size={24} color={colors.primary} />
                      <Text style={styles.uploadButtonText}>Record Video</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={pickVideo}
                  >
                    <Upload size={24} color={colors.primary} />
                    <Text style={styles.uploadButtonText}>Upload Video</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={colors.text.tertiary}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={200}
            />
            <Text style={styles.captionCounter}>{caption.length}/200</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  postButton: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  postButtonDisabled: {
    color: colors.text.tertiary,
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 400,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  videoPreview: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    marginBottom: 20,
  },
  uploadTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  uploadSubtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 32,
  },
  uploadButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.light,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.primary,
  },
  captionInput: {
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border.light,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  captionCounter: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'right',
  },
});
