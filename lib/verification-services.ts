import { supabase } from './supabase';

interface ServiceConfig {
  service_type: 'sms' | 'email';
  provider: string;
  enabled: boolean;
  config: {
    account_sid?: string;
    auth_token?: string;
    phone_number?: string;
    api_key?: string;
    from_email?: string;
    from_name?: string;
  };
}

/**
 * Get service configuration from database
 */
export async function getServiceConfig(serviceType: 'sms' | 'email'): Promise<ServiceConfig | null> {
  try {
    const { data, error } = await supabase
      .from('verification_service_configs')
      .select('*')
      .eq('service_type', serviceType)
      .single();

    if (error) {
      console.error(`Failed to get ${serviceType} config:`, error);
      return null;
    }

    return data as ServiceConfig;
  } catch (error) {
    console.error(`Error getting ${serviceType} config:`, error);
    return null;
  }
}

/**
 * Send SMS verification code via Twilio
 * This should be called from a Supabase Edge Function for security
 */
export async function sendSmsCode(phoneNumber: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getServiceConfig('sms');
    
    if (!config || !config.enabled) {
      return { success: false, error: 'SMS service is not configured or enabled' };
    }

    if (config.provider === 'twilio') {
      try {
        // Call Supabase Edge Function to send SMS
        // The edge function will handle the Twilio API call securely
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: {
            phoneNumber,
            code,
            config: {
              accountSid: config.config.account_sid,
              authToken: config.config.auth_token,
              phoneNumber: config.config.phone_number,
            },
          },
        });

        if (error) {
          console.error('SMS function error:', error);
          // If function doesn't exist or fails, fall back to showing code
          return { success: false, error: 'SMS service unavailable. Please configure edge functions.' };
        }

        return { success: data?.success || false, error: data?.error };
      } catch (err: any) {
        // Edge function might not be deployed yet
        console.error('Failed to invoke SMS function:', err);
        return { success: false, error: 'SMS service not available. Please deploy edge functions.' };
      }
    }

    return { success: false, error: 'Unsupported SMS provider' };
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    return { success: false, error: error.message || 'Failed to send SMS' };
  }
}

/**
 * Send Email verification code via Resend
 * This should be called from a Supabase Edge Function for security
 */
export async function sendEmailCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getServiceConfig('email');
    
    if (!config || !config.enabled) {
      return { success: false, error: 'Email service is not configured or enabled' };
    }

    if (config.provider === 'resend') {
      try {
        // Call Supabase Edge Function to send Email
        // The edge function will handle the Resend API call securely
        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            email,
            code,
            config: {
              apiKey: config.config.api_key,
              fromEmail: config.config.from_email,
              fromName: config.config.from_name || 'Committed',
            },
          },
        });

        if (error) {
          console.error('Email function error:', error);
          // If function doesn't exist or fails, fall back to showing code
          return { success: false, error: 'Email service unavailable. Please configure edge functions.' };
        }

        return { success: data?.success || false, error: data?.error };
      } catch (err: any) {
        // Edge function might not be deployed yet
        console.error('Failed to invoke email function:', err);
        return { success: false, error: 'Email service not available. Please deploy edge functions.' };
      }
    }

    // Fallback: Use Supabase Auth email if Resend is not configured
    if (config.provider === 'supabase') {
      // For now, we'll use a simple approach - store code in database
      // and let the user enter it manually
      return { success: true };
    }

    return { success: false, error: 'Unsupported email provider' };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Fallback: Send email using Supabase's built-in email (if edge function fails)
 * This creates a verification code entry that can be checked
 */
export async function createVerificationCode(
  userId: string,
  type: 'phone' | 'email',
  contact: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const insertData: any = {
      user_id: userId,
      verification_type: type,
      code,
      expires_at: expiresAt,
      used: false,
    };

    // Also set type column if it exists (for backward compatibility)
    insertData.type = type;

    if (type === 'phone') {
      insertData.phone_number = contact;
    } else {
      insertData.email = contact;
    }

    const { error } = await supabase
      .from('verification_codes')
      .insert(insertData);

    if (error) {
      console.error('Failed to create verification code:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error creating verification code:', error);
    return { success: false, error: error.message || 'Failed to create verification code' };
  }
}
