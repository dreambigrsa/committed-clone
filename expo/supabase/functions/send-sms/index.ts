// Supabase Edge Function for sending SMS via Twilio
// Deploy this function to Supabase: supabase functions deploy send-sms

// @ts-ignore - Deno runtime import
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno runtime import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_API_URL = 'https://api.twilio.com/2010-04-01';

interface RequestBody {
  phoneNumber: string;
  code: string;
  config: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
  };
}

serve(async (req: Request) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      });
    }

    const { phoneNumber, code, config }: RequestBody = await req.json();

    if (!phoneNumber || !code || !config.accountSid || !config.authToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required parameters' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Send SMS via Twilio
    const message = `Your Committed verification code is: ${code}. This code will expire in 10 minutes.`;
    const url = `${TWILIO_API_URL}/Accounts/${config.accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', config.phoneNumber);
    formData.append('To', phoneNumber);
    formData.append('Body', message);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.message || 'Failed to send SMS' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, messageSid: data.sid }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
});

