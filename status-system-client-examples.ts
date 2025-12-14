/**
 * STATUS SYSTEM - CLIENT QUERY EXAMPLES
 * 
 * This file contains example queries for integrating the Status system
 * into your Feed and Messenger screens.
 * 
 * All queries automatically respect RLS policies and privacy rules.
 */

import { supabase } from '@/lib/supabase';

// ============================================
// TYPES
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
  // Joined data
  user?: {
    id: string;
    full_name: string;
    profile_picture: string | null;
  };
  has_unviewed?: boolean; // Whether current user hasn't viewed this status
  view_count?: number; // Number of views
}

export interface StatusFeedItem {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  latest_status: Status | null;
  has_unviewed: boolean;
}

// ============================================
// FEED QUERIES (Facebook Feed Style)
// ============================================

/**
 * Get status feed for the main Feed screen
 * Returns one bubble per user with their latest status
 * Shows user's own status first, then friends/followed users
 */
export async function getStatusFeedForFeed(): Promise<StatusFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get latest visible status per user
  // This query uses the can_view_status function via RLS
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
      archived_at,
      users:user_id (
        id,
        full_name,
        profile_picture
      )
    `)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching status feed:', error);
    return [];
  }

  if (!statuses) return [];

  // Group by user and get latest status per user
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
        user: status.users,
        has_unviewed: !view,
      });
    }
  }

  // Convert to array and sort (own status first, then by most recent)
  const feedItems: StatusFeedItem[] = [];
  const ownStatus = statusMap.get(user.id);
  if (ownStatus) {
    feedItems.push({
      user_id: user.id,
      user_name: ownStatus.user?.full_name || 'You',
      user_avatar: ownStatus.user?.profile_picture || null,
      latest_status: ownStatus,
      has_unviewed: false, // User's own status is always viewed
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

  // Sort by has_unviewed (unviewed first) then by created_at (newest first)
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

  return statuses || [];
}

/**
 * Mark a status as viewed
 */
export async function markStatusAsViewed(statusId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('status_views')
    .insert({
      status_id: statusId,
      viewer_id: user.id,
      viewed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Ignore duplicate key errors (already viewed)
    if (error.code !== '23505') {
      console.error('Error marking status as viewed:', error);
      return false;
    }
  }

  return true;
}

/**
 * Get signed URL for status media
 */
export async function getStatusMediaUrl(mediaPath: string): Promise<string | null> {
  if (!mediaPath) return null;

  // Extract file path from full path
  // Format: status-media/{user_id}/{status_id}/filename
  const pathParts = mediaPath.split('/');
  if (pathParts.length < 2) return null;

  const filePath = pathParts.slice(1).join('/');

  const { data, error } = await supabase.storage
    .from('status-media')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }

  return data?.signedUrl || null;
}

// ============================================
// MESSENGER QUERIES (WhatsApp Style)
// ============================================

/**
 * Get status feed for Messenger screen
 * Shows statuses for friends and recent chat participants
 */
export async function getStatusFeedForMessenger(): Promise<StatusFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get friends list
  const { data: friends } = await supabase
    .from('friends')
    .select('friend_id, user_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted');

  const friendIds = new Set<string>();
  if (friends) {
    for (const friend of friends) {
      if (friend.user_id === user.id) {
        friendIds.add(friend.friend_id);
      } else {
        friendIds.add(friend.user_id);
      }
    }
  }

  // Get recent chat participants
  const { data: conversations } = await supabase
    .from('conversations')
    .select('participant_ids')
    .contains('participant_ids', [user.id])
    .order('last_message_at', { ascending: false })
    .limit(20);

  const chatParticipantIds = new Set<string>();
  if (conversations) {
    for (const conv of conversations) {
      for (const pid of conv.participant_ids || []) {
        if (pid !== user.id) {
          chatParticipantIds.add(pid);
        }
      }
    }
  }

  // Combine friend and chat participant IDs
  const relevantUserIds = Array.from(new Set([...friendIds, ...chatParticipantIds]));

  if (relevantUserIds.length === 0) return [];

  // Get latest status for each relevant user
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
      archived_at,
      users:user_id (
        id,
        full_name,
        profile_picture
      )
    `)
    .in('user_id', relevantUserIds)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messenger status feed:', error);
    return [];
  }

  if (!statuses) return [];

  // Group by user and get latest
  const statusMap = new Map<string, Status>();

  for (const status of statuses) {
    const userId = status.user_id;
    if (!statusMap.has(userId)) {
      const { data: view } = await supabase
        .from('status_views')
        .select('id')
        .eq('status_id', status.id)
        .eq('viewer_id', user.id)
        .single();

      statusMap.set(userId, {
        ...status,
        user: status.users,
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

  // Add other users, prioritizing recent chat participants
  const sortedUserIds = [...relevantUserIds].sort((a, b) => {
    const aInChat = chatParticipantIds.has(a);
    const bInChat = chatParticipantIds.has(b);
    if (aInChat !== bInChat) return aInChat ? -1 : 1;
    
    const aStatus = statusMap.get(a);
    const bStatus = statusMap.get(b);
    if (!aStatus || !bStatus) return 0;
    return new Date(bStatus.created_at).getTime() - 
           new Date(aStatus.created_at).getTime();
  });

  for (const userId of sortedUserIds) {
    const status = statusMap.get(userId);
    if (status) {
      feedItems.push({
        user_id: userId,
        user_name: status.user?.full_name || 'Unknown',
        user_avatar: status.user?.profile_picture || null,
        latest_status: status,
        has_unviewed: status.has_unviewed || false,
      });
    }
  }

  return feedItems;
}

// ============================================
// CREATE STATUS
// ============================================

/**
 * Create a new status
 */
export async function createStatus(
  contentType: 'text' | 'image' | 'video',
  textContent: string | null,
  mediaFile: File | null,
  privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom',
  allowedUserIds?: string[] // For custom privacy
): Promise<Status | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let mediaPath: string | null = null;

  // Upload media if provided
  if (mediaFile) {
    const statusId = crypto.randomUUID();
    const fileExt = mediaFile.name.split('.').pop();
    const fileName = `${statusId}.${fileExt}`;
    const filePath = `${user.id}/${statusId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('status-media')
      .upload(filePath, mediaFile, {
        contentType: mediaFile.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading status media:', uploadError);
      return null;
    }

    mediaPath = `status-media/${filePath}`;
  }

  // Create status record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  const { data: status, error: statusError } = await supabase
    .from('statuses')
    .insert({
      user_id: user.id,
      content_type: contentType,
      text_content: textContent,
      media_path: mediaPath,
      privacy_level: privacyLevel,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (statusError) {
    console.error('Error creating status:', statusError);
    // Clean up uploaded media if status creation failed
    if (mediaPath) {
      const pathParts = mediaPath.split('/');
      const filePath = pathParts.slice(1).join('/');
      await supabase.storage.from('status-media').remove([filePath]);
    }
    return null;
  }

  // Add custom visibility rules if needed
  if (privacyLevel === 'custom' && allowedUserIds && allowedUserIds.length > 0) {
    const visibilityRecords = allowedUserIds.map(uid => ({
      status_id: status.id,
      allowed_user_id: uid,
    }));

    const { error: visibilityError } = await supabase
      .from('status_visibility')
      .insert(visibilityRecords);

    if (visibilityError) {
      console.error('Error setting custom visibility:', visibilityError);
      // Status is still created, just without custom visibility
    }
  }

  return status;
}

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

/**
 * Get view count for a status (owner only)
 */
export async function getStatusViewCount(statusId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  // Verify ownership
  const { data: status } = await supabase
    .from('statuses')
    .select('id')
    .eq('id', statusId)
    .eq('user_id', user.id)
    .single();

  if (!status) return 0;

  const { count, error } = await supabase
    .from('status_views')
    .select('*', { count: 'exact', head: true })
    .eq('status_id', statusId);

  if (error) {
    console.error('Error getting view count:', error);
    return 0;
  }

  return count || 0;
}

