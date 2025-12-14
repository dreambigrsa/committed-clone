/**
 * Status System Queries
 * 
 * Client-side functions for interacting with the status system
 * Handles fetching, creating, viewing, and deleting statuses
 */

import { supabase } from './supabase';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Status {
  id: string;
  user_id: string;
  content_type: 'text' | 'image' | 'video';
  text_content: string | null;
  media_path: string | null;
  privacy_level: 'public' | 'friends' | 'followers' | 'only_me' | 'custom';
  created_at: string;
  expires_at: string;
  archived: boolean;
  archived_at: string | null;
  user?: {
    id: string;
    full_name: string;
    profile_picture: string | null;
  };
  has_unviewed?: boolean;
}

export interface StatusFeedItem {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  latest_status: Status;
  has_unviewed: boolean;
}

// ============================================
// FEED QUERIES (Facebook Feed Style)
// ============================================

/**
 * Get status feed for the main Feed screen
 * Returns one bubble per user with their latest status
 */
export async function getStatusFeedForFeed(): Promise<StatusFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all visible statuses (RLS filters automatically)
  const { data: statuses, error } = await supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at
    `)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.warn('Status table not found. Please run COMPLETE-STATUS-SETUP-FINAL.sql in Supabase SQL Editor.');
      return [];
    }
    console.error('Error fetching status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) return [];

  // Fetch user data for all status owners
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const userIds = Array.from<string>(new Set<string>(statuses.map((s: Status) => s.user_id).filter((id: string) => {
    if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string') {
      return false;
    }
    return uuidRegex.test(id);
  })));

  if (userIds.length === 0) {
    console.warn('No valid user IDs found in statuses');
    return [];
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', userIds);

  if (usersError) {
    console.error('Error fetching user data for statuses:', usersError);
  }

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  }

  // Group by user, keeping only latest status per user
  const statusMap = new Map<string, Status>();

  for (const status of statuses) {
    const userId = status.user_id;
    if (!statusMap.has(userId)) {
      // Check if user has viewed this status
      const { data: view } = await supabase
        .from('status_views')
        .select('id')
        .eq('status_id', status.id)
        .eq('viewer_id', user.id)
        .single();

      statusMap.set(userId, {
        ...status,
        user: usersMap.get(userId) || undefined,
        has_unviewed: !view,
      });
    }
  }

  // Build feed items
  const feedItems: StatusFeedItem[] = [];

  // Add own status first
  const ownStatus = statusMap.get(user.id);
  if (ownStatus) {
    feedItems.push({
      user_id: user.id,
      user_name: ownStatus.user?.full_name || 'You',
      user_avatar: ownStatus.user?.profile_picture || null,
      latest_status: ownStatus,
      has_unviewed: false,
    });
    statusMap.delete(user.id);
  }

  // Add other users' statuses
  for (const [userId, status] of statusMap.entries()) {
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || 'Unknown',
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: status.has_unviewed || false,
    });
  }

  // Sort: unviewed first, then by most recent
  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    if (!a.latest_status || !b.latest_status) return 0;
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  return feedItems;
}

/**
 * Get all statuses for a specific user (for viewing their story)
 */
export async function getUserStatuses(userId: string): Promise<Status[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('Invalid userId provided to getUserStatuses:', userId);
    return [];
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('Invalid UUID format for userId:', userId);
    return [];
  }

  const { data: statuses, error } = await supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at
    `)
    .eq('user_id', userId)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching user statuses:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) return [];

  // Fetch user data
  const { data: userData } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .eq('id', userId)
    .single();

  return statuses.map((status: Status) => ({
    ...status,
    user: userData || undefined,
  }));
}

/**
 * Get status feed for the Messages screen
 */
export async function getStatusFeedForMessenger(): Promise<StatusFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get friends list
  const { data: friends } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  const friendIds = friends?.map((f) => f.friend_id) || [];

  // Get all visible statuses from friends
  const { data: statuses, error } = await supabase
    .from('statuses')
    .select(`
      id,
      user_id,
      content_type,
      text_content,
      media_path,
      privacy_level,
      created_at,
      expires_at,
      archived,
      archived_at
    `)
    .in('user_id', friendIds.length > 0 ? friendIds : [user.id]) // Fallback to own status if no friends
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messenger status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) return [];

  // Similar processing as getStatusFeedForFeed
  const userIds = Array.from<string>(new Set<string>(statuses.map((s: Status) => s.user_id)));
  
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', userIds);

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  }

  const statusMap = new Map<string, Status>();
  for (const status of statuses) {
    if (!statusMap.has(status.user_id)) {
      const { data: view } = await supabase
        .from('status_views')
        .select('id')
        .eq('status_id', status.id)
        .eq('viewer_id', user.id)
        .single();

      statusMap.set(status.user_id, {
        ...status,
        user: usersMap.get(status.user_id) || undefined,
        has_unviewed: !view,
      });
    }
  }

  const feedItems: StatusFeedItem[] = [];
  for (const [userId, status] of statusMap.entries()) {
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || 'Unknown',
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: status.has_unviewed || false,
    });
  }

  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  return feedItems;
}

// ============================================
// STATUS CREATION
// ============================================

/**
 * Create a new status
 */
export async function createStatus(
  contentType: 'text' | 'image' | 'video',
  textContent: string | null,
  mediaUri: string | null,
  privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom',
  allowedUserIds?: string[]
): Promise<Status | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error('User not authenticated');
    return null;
  }

  // Get session for RLS
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) {
    console.error('No active session found');
    return null;
  }

  let mediaPath: string | null = null;

  // Upload media if provided
  if (mediaUri && (contentType === 'image' || contentType === 'video')) {
    try {
      const response = await fetch(mediaUri);
      const blob = await response.blob();
      const fileExt = contentType === 'video' ? 'mp4' : 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('status-media')
        .upload(filePath, blob, {
          contentType: contentType === 'video' ? 'video/mp4' : 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading status media:', uploadError);
        return null;
      }

      mediaPath = `status-media/${filePath}`;
    } catch (error) {
      console.error('Error processing media:', error);
      return null;
    }
  }

  // Create status record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const insertData: any = {
    user_id: session.user.id,
    content_type: contentType,
    text_content: textContent,
    media_path: mediaPath,
    privacy_level: privacyLevel,
    expires_at: expiresAt.toISOString(),
  };

  const { data: status, error: statusError } = await supabase
    .from('statuses')
    .insert(insertData)
    .select()
    .single();

  if (statusError) {
    console.error('Error creating status:', statusError);
    return null;
  }

  // Handle custom privacy
  if (privacyLevel === 'custom' && allowedUserIds && allowedUserIds.length > 0) {
    const visibilityRecords = allowedUserIds.map((userId) => ({
      status_id: status.id,
      allowed_user_id: userId,
    }));

    await supabase.from('status_visibility').insert(visibilityRecords);
  }

  return status;
}

// ============================================
// STATUS VIEWING
// ============================================

/**
 * Mark a status as viewed
 */
export async function markStatusAsViewed(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('status_views')
    .upsert({
      status_id: statusId,
      viewer_id: user.id,
      viewed_at: new Date().toISOString(),
    }, {
      onConflict: 'status_id,viewer_id',
    });

  if (error) {
    console.error('Error marking status as viewed:', error);
    return false;
  }

  return true;
}

/**
 * Get signed URL for status media
 */
export async function getSignedUrlForMedia(mediaPath: string): Promise<string | null> {
  if (!mediaPath) return null;

  // Remove 'status-media/' prefix if present
  const path = mediaPath.startsWith('status-media/') 
    ? mediaPath.substring('status-media/'.length)
    : mediaPath;

  const { data, error } = await supabase.storage
    .from('status-media')
    .createSignedUrl(path, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

// ============================================
// STATUS DELETION
// ============================================

/**
 * Delete a status (owner only)
 */
export async function deleteStatus(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Get status to check ownership and get media path
  const { data: status } = await supabase
    .from('statuses')
    .select('media_path')
    .eq('id', statusId)
    .eq('user_id', user.id)
    .single();

  if (!status) return false;

  // Delete media if exists
  if (status.media_path) {
    const pathParts = status.media_path.split('/');
    const filePath = pathParts.slice(1).join('/');
    await supabase.storage.from('status-media').remove([filePath]);
  }

  // Delete status
  const { error } = await supabase
    .from('statuses')
    .delete()
    .eq('id', statusId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting status:', error);
    return false;
  }

  return true;
}

