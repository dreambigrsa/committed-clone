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
  console.log('🔍 [getStatusFeedForFeed] Starting...');
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ [getStatusFeedForFeed] Auth error:', userError);
    return [];
  }
  
  if (!user) {
    console.warn('⚠️ [getStatusFeedForFeed] No user found');
    return [];
  }

  console.log('✅ [getStatusFeedForFeed] User authenticated:', user.id);

  // Get all visible statuses (RLS filters automatically)
  // Remove client-side filters to see what RLS returns
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
    .order('created_at', { ascending: false });

  console.log('📊 [getStatusFeedForFeed] Query result:', {
    statusesCount: statuses?.length || 0,
    statuses: statuses ? statuses.map((s: any) => ({
      id: s.id?.substring(0, 8) + '...',
      user_id: s.user_id?.substring(0, 8) + '...',
      archived: s.archived,
      expires_at: s.expires_at,
      privacy_level: s.privacy_level,
    })) : null,
    error: error ? {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    } : null,
  });

  if (error) {
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.warn('⚠️ Status table not found. Please run COMPLETE-STATUS-SETUP-FINAL.sql in Supabase SQL Editor.');
      return [];
    }
    console.error('❌ [getStatusFeedForFeed] Error fetching status feed:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No statuses returned from query');
    return [];
  }

  console.log('📋 [getStatusFeedForFeed] Raw statuses:', statuses.map(s => ({
    id: s.id,
    user_id: s.user_id,
    archived: s.archived,
    expires_at: s.expires_at,
    privacy_level: s.privacy_level,
  })));

  // Filter by archived and expires_at on client side
  const now = new Date().toISOString();
  const activeStatuses = statuses.filter((s: Status) => {
    const isNotArchived = s.archived === false;
    const isNotExpired = s.expires_at > now;
    return isNotArchived && isNotExpired;
  });

  console.log('✅ [getStatusFeedForFeed] Active statuses after filtering:', activeStatuses.length);

  if (activeStatuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No active statuses after filtering');
    return [];
  }

  // Fetch user data for all status owners
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const userIds = Array.from<string>(new Set<string>(activeStatuses.map((s: Status) => s.user_id).filter((id: string) => {
    if (!id || id === 'undefined' || id === 'null' || typeof id !== 'string') {
      return false;
    }
    return uuidRegex.test(id);
  })));

  console.log('👥 [getStatusFeedForFeed] User IDs to fetch:', userIds.length);

  if (userIds.length === 0) {
    console.warn('⚠️ [getStatusFeedForFeed] No valid user IDs found in statuses');
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
    console.log('✅ [getStatusFeedForFeed] Fetched user data:', usersData.length, 'users');
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  } else {
    console.warn('⚠️ [getStatusFeedForFeed] No user data returned');
  }

  // Group by user, keeping only latest status per user
  const statusMap = new Map<string, Status>();

  console.log('🔄 [getStatusFeedForFeed] Processing statuses:', activeStatuses.length);
  
  for (const status of activeStatuses) {
    const userId = status.user_id;
    if (!statusMap.has(userId)) {
      // Check if user has viewed this status
      const { data: view, error: viewError } = await supabase
        .from('status_views')
        .select('id')
        .eq('status_id', status.id)
        .eq('viewer_id', user.id)
        .maybeSingle();

      if (viewError && viewError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.warn('⚠️ [getStatusFeedForFeed] Error checking view status:', viewError);
      }

      statusMap.set(userId, {
        ...status,
        user: usersMap.get(userId) || undefined,
        has_unviewed: !view,
      });
      
      console.log(`✅ [getStatusFeedForFeed] Added status for user ${userId}:`, {
        hasUnviewed: !view,
        hasUserData: !!usersMap.get(userId),
      });
    }
  }
  
  console.log(`📦 [getStatusFeedForFeed] Status map size:`, statusMap.size);

  // Build feed items
  const feedItems: StatusFeedItem[] = [];

  // IMPORTANT: Include ALL statuses, including own status
  // The component will handle displaying them appropriately
  for (const [userId, status] of statusMap.entries()) {
    const isOwnStatus = userId === user.id;
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || (isOwnStatus ? 'You' : 'Unknown'),
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: isOwnStatus ? false : (status.has_unviewed || false),
    });
  }

  console.log(`📦 [getStatusFeedForFeed] Built feed items:`, {
    totalItems: feedItems.length,
    ownStatusIncluded: feedItems.some(item => item.user_id === user.id),
    ownStatusUser: feedItems.find(item => item.user_id === user.id)?.user_name,
    otherStatusesCount: feedItems.filter(item => item.user_id !== user.id).length,
    allUserIds: feedItems.map(item => item.user_id),
  });

  // Sort: unviewed first, then by most recent
  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    if (!a.latest_status || !b.latest_status) return 0;
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  console.log('🎉 [getStatusFeedForFeed] Final feed items:', feedItems.length);
  console.log('📝 [getStatusFeedForFeed] Feed items:', feedItems.map(item => ({
    user_id: item.user_id,
    user_name: item.user_name,
    has_unviewed: item.has_unviewed,
  })));

  // DEBUG: If no feed items, log everything we know
  if (feedItems.length === 0) {
    console.error('❌ [getStatusFeedForFeed] NO FEED ITEMS RETURNED!');
    console.error('📋 [getStatusFeedForFeed] Debug info:', {
      activeStatusesCount: activeStatuses.length,
      userIdsCount: userIds.length,
      usersDataCount: usersData?.length || 0,
      statusMapSize: statusMap.size,
      currentUserId: user.id,
      statusesFromQuery: statuses?.length || 0,
      allStatusUserIds: statuses?.map((s: any) => s.user_id) || [],
    });
  }

  return feedItems;
}

/**
 * Get all statuses for a specific user (for viewing their story)
 */
export async function getUserStatuses(userId: string): Promise<Status[]> {
  console.log('🔍 [getUserStatuses] Starting:', { userId });
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn('⚠️ [getUserStatuses] No user found');
    return [];
  }

  if (!userId || userId === 'undefined' || userId === 'null') {
    console.error('❌ [getUserStatuses] Invalid userId:', userId);
    return [];
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('❌ [getUserStatuses] Invalid UUID format:', userId);
    return [];
  }

  const isOwnStatus = userId === user.id;
  console.log('👤 [getUserStatuses] Is own status:', isOwnStatus);

  // Build query - for own statuses, show ALL (even expired/archived) for management
  // For others, only show active statuses
  let query = supabase
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
    .eq('user_id', userId);

  if (!isOwnStatus) {
    // For others, only show active statuses
    query = query
      .eq('archived', false)
      .gt('expires_at', new Date().toISOString());
  }
  // For own statuses, show all (no filters) - RLS policy "Users can view own statuses always" allows this

  const { data: statuses, error } = await query.order('created_at', { ascending: true });

  console.log('📊 [getUserStatuses] Query result:', {
    statusesCount: statuses?.length || 0,
    isOwnStatus,
    statuses: statuses?.map((s: any) => ({
      id: s.id?.substring(0, 8) + '...',
      content_type: s.content_type,
      archived: s.archived,
      expires_at: s.expires_at,
    })),
    error: error ? { 
      code: error.code, 
      message: error.message,
      details: error.details,
      hint: error.hint,
    } : null,
  });

  if (error) {
    console.error('❌ [getUserStatuses] Error fetching user statuses:', error);
    if (error.code === 'PGRST200' || error.message?.includes('schema cache')) {
      console.error('❌ [getUserStatuses] Table might not exist. Run COMPLETE-STATUS-FIX.sql');
    }
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getUserStatuses] No statuses returned for user:', userId);
    return [];
  }

  // Fetch user data
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .eq('id', userId)
    .single();

  if (userError) {
    console.error('❌ [getUserStatuses] Error fetching user data:', userError);
  }

  const result = statuses.map((status: Status) => ({
    ...status,
    user: userData || undefined,
  }));

  console.log('✅ [getUserStatuses] Returning:', {
    count: result.length,
    userData: !!userData,
  });

  return result;
}

/**
 * Get status feed for the Messages screen
 */
export async function getStatusFeedForMessenger(): Promise<StatusFeedItem[]> {
  console.log('🔍 [getStatusFeedForMessenger] Starting...');
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('❌ [getStatusFeedForMessenger] Auth error:', userError);
    return [];
  }
  
  if (!user) {
    console.warn('⚠️ [getStatusFeedForMessenger] No user found');
    return [];
  }

  console.log('✅ [getStatusFeedForMessenger] User authenticated:', user.id);

  // Get friends list
  const { data: friends, error: friendsError } = await supabase
    .from('friends')
    .select('friend_id')
    .eq('user_id', user.id)
    .eq('status', 'accepted');

  if (friendsError) {
    console.error('❌ [getStatusFeedForMessenger] Error fetching friends:', friendsError);
  }

  const friendIds = friends?.map((f) => f.friend_id) || [];
  console.log('👥 [getStatusFeedForMessenger] Friends count:', friendIds.length);

  // Get all visible statuses (from friends AND recent chat participants)
  // For now, get all visible statuses (RLS will filter based on privacy)
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

  console.log('📊 [getStatusFeedForMessenger] Query result:', {
    statusesCount: statuses?.length || 0,
    error: error ? {
      message: error.message,
      code: error.code,
    } : null,
  });

  if (error) {
    console.error('❌ [getStatusFeedForMessenger] Error fetching statuses:', error);
    return [];
  }

  if (!statuses || statuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForMessenger] No statuses returned');
    return [];
  }

  // Filter to only show statuses from friends (or own status)
  const filteredStatuses = statuses.filter((s: Status) => {
    return s.user_id === user.id || friendIds.includes(s.user_id);
  });

  console.log('✅ [getStatusFeedForMessenger] Filtered statuses:', {
    total: statuses.length,
    afterFriendFilter: filteredStatuses.length,
  });

  if (filteredStatuses.length === 0) {
    console.warn('⚠️ [getStatusFeedForMessenger] No statuses after friend filter');
    return [];
  }

  // Similar processing as getStatusFeedForFeed
  const userIds = Array.from<string>(new Set<string>(filteredStatuses.map((s: Status) => s.user_id)));
  
  const { data: usersData } = await supabase
    .from('users')
    .select('id, full_name, profile_picture')
    .in('id', userIds);

  const usersMap = new Map<string, { id: string; full_name: string; profile_picture: string | null }>();
  if (usersData) {
    console.log('✅ [getStatusFeedForMessenger] Fetched user data:', usersData.length);
    usersData.forEach((u: { id: string; full_name: string; profile_picture: string | null }) => {
      usersMap.set(u.id, u);
    });
  } else {
    console.warn('⚠️ [getStatusFeedForMessenger] No user data returned');
  }

  const statusMap = new Map<string, Status>();
  for (const status of filteredStatuses) {
    if (!statusMap.has(status.user_id)) {
      const { data: view, error: viewError } = await supabase
        .from('status_views')
        .select('id')
        .eq('status_id', status.id)
        .eq('viewer_id', user.id)
        .maybeSingle();

      if (viewError && viewError.code !== 'PGRST116') {
        console.warn('⚠️ [getStatusFeedForMessenger] Error checking view:', viewError);
      }

      statusMap.set(status.user_id, {
        ...status,
        user: usersMap.get(status.user_id) || undefined,
        has_unviewed: !view,
      });
    }
  }

  const feedItems: StatusFeedItem[] = [];
  for (const [userId, status] of statusMap.entries()) {
    const isOwnStatus = userId === user.id;
    feedItems.push({
      user_id: userId,
      user_name: status.user?.full_name || (isOwnStatus ? 'You' : 'Unknown'),
      user_avatar: status.user?.profile_picture || null,
      latest_status: status,
      has_unviewed: isOwnStatus ? false : (status.has_unviewed || false),
    });
  }

  feedItems.sort((a, b) => {
    if (a.has_unviewed !== b.has_unviewed) {
      return a.has_unviewed ? -1 : 1;
    }
    return new Date(b.latest_status.created_at).getTime() - 
           new Date(a.latest_status.created_at).getTime();
  });

  console.log('🎉 [getStatusFeedForMessenger] Final feed items:', feedItems.length);

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
  if (!user) {
    console.warn('⚠️ [markStatusAsViewed] No user found');
    return false;
  }

  // Get session to ensure RLS works
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) {
    console.error('❌ [markStatusAsViewed] No session found');
    return false;
  }

  console.log('👁️ [markStatusAsViewed] Marking status as viewed:', {
    statusId,
    viewerId: user.id,
  });

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
    console.error('❌ [markStatusAsViewed] Error marking status as viewed:', error);
    console.error('❌ [markStatusAsViewed] Error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return false;
  }

  console.log('✅ [markStatusAsViewed] Successfully marked as viewed');
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

