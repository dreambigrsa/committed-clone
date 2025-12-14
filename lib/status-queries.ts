/**
 * STATUS SYSTEM - CLIENT QUERIES
 * 
 * Production-ready queries for Status/Stories system
 * All queries respect RLS policies and privacy rules
 */

import { supabase } from './supabase';

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
  has_unviewed?: boolean;
  view_count?: number;
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
 */
export async function getStatusFeedForFeed(): Promise<StatusFeedItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all visible statuses (RLS filters automatically)
  // Note: If statuses table doesn't exist yet, return empty array
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
    // If table doesn't exist, silently return empty array
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.warn('Status table not found. Please run supabase-status-system-schema.sql in Supabase SQL Editor.');
      return [];
    }
    console.error('Error fetching status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) return [];

  // Fetch user data for all status owners
  // Filter out any invalid user_ids
  // Basic UUID validation regex
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
    // Continue with empty user map rather than failing completely
  }

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  }

  // Group by user, keeping only latest status per user
  const statusMap = new Map<string, Status>();
  const uniqueUserIds = new Set<string>();

  for (const status of statuses) {
    const userId = status.user_id;
    if (!statusMap.has(userId)) {
      uniqueUserIds.add(userId);
      
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

  // Check which users have unviewed statuses
  const unviewedUserIds = new Set<string>();
  for (const [userId, status] of statusMap.entries()) {
    if (status.has_unviewed) {
      unviewedUserIds.add(userId);
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

  // Validate userId is not undefined or invalid
  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('Invalid userId provided to getUserStatuses:', userId);
    return [];
  }

  // Validate UUID format (basic check)
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

  return (statuses || []) as Status[];
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
  // Filter out invalid UUIDs
  const uuidRegexMessenger = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allIds = [...Array.from(friendIds), ...Array.from(chatParticipantIds)].filter((id: string) => {
    return id && id !== 'undefined' && id !== 'null' && typeof id === 'string' && uuidRegexMessenger.test(id);
  });
  const relevantUserIds = Array.from<string>(new Set<string>(allIds));

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
      archived_at
    `)
    .in('user_id', relevantUserIds)
    .eq('archived', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching messenger status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) return [];

  // Fetch user data
  // Filter out invalid user_ids (reuse the same regex)
  const statusUserIds = Array.from<string>(new Set<string>(statuses.map((s: Status) => s.user_id).filter((id: string) => {
    return id && id !== 'undefined' && id !== 'null' && typeof id === 'string' && uuidRegexMessenger.test(id);
  })));

  if (statusUserIds.length === 0) {
    console.warn('No valid user IDs found in messenger statuses');
    return [];
  }

  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', statusUserIds);

  if (usersError) {
    console.error('Error fetching user data for messenger statuses:', usersError);
    // Continue with empty user map rather than failing completely
  }

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  }

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
  mediaUri: string | null, // Local file URI from ImagePicker
  privacyLevel: 'public' | 'friends' | 'followers' | 'only_me' | 'custom',
  allowedUserIds?: string[] // For custom privacy
): Promise<Status | null> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.error('Error getting authenticated user:', authError);
    return null;
  }
  
  if (!user || !user.id) {
    console.error('No authenticated user found or user.id is missing');
    return null;
  }

  // Validate user.id is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(user.id)) {
    console.error('Invalid user.id format:', user.id);
    return null;
  }

  let mediaPath: string | null = null;

  // Upload media if provided
  if (mediaUri) {
    try {
      const statusId = crypto.randomUUID();
      
      // Determine file extension from URI
      const uriParts = mediaUri.split('.');
      const fileExt = uriParts[uriParts.length - 1] || (contentType === 'video' ? 'mp4' : 'jpg');
      const fileName = `${statusId}.${fileExt}`;
      const filePath = `${user.id}/${statusId}/${fileName}`;

      // Read file as blob
      const response = await fetch(mediaUri);
      const blob = await response.blob();

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('status-media')
        .upload(filePath, blob, {
          contentType: contentType === 'video' ? 'video/mp4' : 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading status media:', uploadError);
        console.error('Upload details:', {
          bucket: 'status-media',
          path: filePath,
          userId: user.id,
          fileSize: blob.size,
          contentType: contentType === 'video' ? 'video/mp4' : 'image/jpeg',
        });
        
        // If it's a 403, it's likely a storage policy issue
        const errorStatus = (uploadError as any).statusCode || (uploadError as any).status;
        if (errorStatus === 403 || uploadError.message?.includes('403') || uploadError.message?.includes('Forbidden')) {
          console.error('403 Forbidden: Storage policy may be blocking upload. Check that:');
          console.error('1. The status-media bucket exists in Supabase Storage');
          console.error('2. The storage policies are correctly set up');
          console.error('3. The user is authenticated and user.id matches the first folder in the path');
        }
        
        return null;
      }

      // The storage path should include the bucket name
      mediaPath = `status-media/${filePath}`;
    } catch (error) {
      console.error('Error processing media:', error);
      return null;
    }
  }

  // Create status record
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  // Log what we're trying to insert for debugging
  const insertData = {
    user_id: user.id,
    content_type: contentType,
    text_content: textContent,
    media_path: mediaPath,
    privacy_level: privacyLevel,
    expires_at: expiresAt.toISOString(),
  };
  
  // Get current auth user to compare
  const { data: { user: authUser } } = await supabase.auth.getUser();
  
  console.log('=== STATUS CREATION DEBUG ===');
  console.log('User from getUser():', {
    id: user.id,
    email: user.email,
    type: typeof user.id,
  });
  console.log('Auth user from auth.getUser():', {
    id: authUser?.id,
    email: authUser?.email,
    type: typeof authUser?.id,
  });
  console.log('IDs match:', user.id === authUser?.id);
  console.log('Insert data:', {
    ...insertData,
    user_id_type: typeof insertData.user_id,
  });

  // IMPORTANT: Ensure we have a valid session before inserting
  // This is critical - RLS policies depend on auth.uid() which comes from the session token
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Error getting session:', sessionError);
    return null;
  }
  
  if (!session) {
    console.error('No active session found! User is not logged in.');
    console.error('RLS policies require an authenticated session to work.');
    return null;
  }

  if (!session.access_token) {
    console.error('Session exists but has no access token!');
    return null;
  }

  console.log('=== SESSION VERIFICATION ===');
  console.log('Has session:', !!session);
  console.log('Session user ID:', session.user?.id);
  console.log('getUser() user ID:', user.id);
  console.log('IDs match:', user.id === session.user?.id);
  console.log('Has access token:', !!session.access_token);
  console.log('Session expires at:', session.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A');

  // Always use session.user.id for consistency with auth.uid()
  // This ensures the user_id matches what auth.uid() will return
  const finalUserId = session.user.id;
  
  if (user.id !== finalUserId) {
    console.warn('User ID mismatch! Using session user ID instead.', {
      getUserUserId: user.id,
      sessionUserId: finalUserId,
    });
  }
  
  insertData.user_id = finalUserId;

  const { data: status, error: statusError } = await supabase
    .from('statuses')
    .insert(insertData)
    .select()
    .single();

  if (statusError) {
    console.error('Error creating status:', statusError);
    console.error('Status insert details:', {
      user_id: user.id,
      content_type: contentType,
      privacy_level: privacyLevel,
      has_media: !!mediaPath,
    });
    
    // If it's a 403 or RLS error, provide helpful message
    if (statusError.code === '42501' || statusError.message?.includes('row-level security') || statusError.message?.includes('RLS')) {
      console.error('RLS Policy Violation: Check that:');
      console.error('1. RLS is enabled on statuses table');
      console.error('2. The "Users can create own statuses" policy exists');
      console.error('3. The policy allows INSERT with auth.uid() = user_id');
      console.error('4. The user.id matches auth.uid() in Supabase');
    }
    
    const errorStatus = (statusError as any).statusCode || (statusError as any).status || (statusError as any).code;
    if (errorStatus === 403 || statusError.message?.includes('403') || statusError.message?.includes('Forbidden')) {
      console.error('403 Forbidden: This could be an RLS policy issue or authentication issue');
    }
    
    // Clean up uploaded media if status creation failed
    if (mediaPath) {
      try {
        const pathParts = mediaPath.split('/');
        // Remove bucket name (status-media) and get just the file path
        const filePath = pathParts.length > 1 ? pathParts.slice(1).join('/') : mediaPath.replace('status-media/', '');
        await supabase.storage.from('status-media').remove([filePath]);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded media:', cleanupError);
      }
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

  return status as Status;
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

