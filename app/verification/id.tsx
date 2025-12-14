import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IdCard, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react-native';
import { useApp } from '@/contexts/AppContext';
import colors from '@/constants/colors';
import * as ImagePicker from 'expo-image-picker';
// @ts-ignore - legacy path works at runtime
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';

export default function IdVerificationScreen() {
  const router = useRouter();
  const { currentUser, updateUserProfile } = useApp();
  const [idImageUrl, setIdImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadIdDocument = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'You need to allow access to your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.9,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const fileName = `id_${currentUser?.id}_${Date.now()}.jpg`;
        
        // Convert URI to Uint8Array using legacy API (no deprecation warnings)
        const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
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
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(fileName);

        setIdImageUrl(publicUrl);
      } catch (error) {
        console.error('Failed to upload ID:', error);
        Alert.alert('Error', 'Failed to upload ID document');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const submitForVerification = async () => {
    if (!idImageUrl) {
      Alert.alert('Error', 'Please upload your ID document first');
      return;
    }

    setIsSubmitting(true);
    try {
      await supabase
        .from('verification_documents')
        .insert({
          user_id: currentUser?.id,
          document_url: idImageUrl,
          document_type: 'government_id', // verification_documents allows: 'government_id', 'phone', 'email', 'selfie'
          status: 'pending',
        });

      // Don't mark as verified until admin approves
      // The admin will update the user's verification status upon approval

      Alert.alert(
        'Success',
        'Your ID has been submitted for verification. You will be notified once it is approved.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Failed to submit verification:', error);
      Alert.alert('Error', 'Failed to submit verification request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'ID Verification',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeft size={24} color={colors.text.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <IdCard size={48} color={colors.primary} />
          </View>

          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Upload a government-issued ID to complete your identity verification
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Accepted Documents:</Text>
            <Text style={styles.infoText}>• Driver&apos;s License</Text>
            <Text style={styles.infoText}>• Passport</Text>
            <Text style={styles.infoText}>• National ID Card</Text>
            <Text style={styles.infoText}>• State ID</Text>
          </View>

          {idImageUrl ? (
            <View style={styles.previewContainer}>
              <Text style={styles.previewLabel}>Uploaded Document</Text>
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: idImageUrl }}
                  style={styles.previewImage}
                  contentFit="cover"
                />
                <View style={styles.checkBadge}>
                  <CheckCircle2 size={24} color={colors.secondary} />
                </View>
              </View>
              <TouchableOpacity
                style={styles.changeButton}
                onPress={uploadIdDocument}
              >
                <Text style={styles.changeButtonText}>Change Document</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
              onPress={uploadIdDocument}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Upload size={32} color={colors.primary} />
                  <Text style={styles.uploadButtonText}>Upload ID Document</Text>
                  <Text style={styles.uploadButtonSubtext}>
                    Tap to select from your photos
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {idImageUrl && (
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={submitForVerification}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.text.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit for Verification</Text>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.securityNote}>
            <Text style={styles.securityText}>
              🔒 Your ID is encrypted and securely stored. We will never share your personal information.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: colors.background.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.text.primary,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  uploadButton: {
    backgroundColor: colors.background.primary,
    borderRadius: 20,
    padding: 48,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: colors.primary + '40',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.primary,
    marginTop: 16,
  },
  uploadButtonSubtext: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.text.primary,
    marginBottom: 16,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: 300,
    height: 200,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  checkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  changeButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text.white,
  },
  securityNote: {
    backgroundColor: colors.badge.verified,
    borderRadius: 12,
    padding: 16,
  },
  securityText: {
    fontSize: 14,
    color: colors.badge.verifiedText,
    lineHeight: 20,
    textAlign: 'center',
  },
});
