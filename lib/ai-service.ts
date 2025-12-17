/**
 * AI Service for Committed AI
 * Handles AI responses using OpenAI API or fallback responses
 */

import { supabase } from './supabase';

const COMMITTED_AI_EMAIL = 'ai@committed.app';
const COMMITTED_AI_NAME = 'Committed AI';

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
  imageUrl?: string; // For generated images
  documentUrl?: string; // For generated documents
  documentName?: string; // For generated documents
  contentType?: 'text' | 'image' | 'document'; // Type of response
}

/**
 * Get or create the Committed AI user
 */
export async function getOrCreateAIUser(): Promise<{ id: string } | null> {
  try {
    // First, try to find existing AI user
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('id')
      .eq('email', COMMITTED_AI_EMAIL)
      .maybeSingle();

    if (existingUser) {
      return { id: existingUser.id };
    }

    // If not found, try using a database function
    // Note: The auth user must be created first via Supabase Dashboard
    try {
      const { data: functionResult, error: functionError } = await supabase
        .rpc('create_ai_user');

      if (!functionError && functionResult) {
        // Try to fetch the newly created user
        const { data: newUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', COMMITTED_AI_EMAIL)
          .single();

        if (newUser) {
          return { id: newUser.id };
        }
      }
    } catch (error) {
      console.log('Database function not available or auth user not created yet');
    }

    // If we still don't have the user, return null
    // The user should create the auth user first via Dashboard, then run create-ai-user.sql
    console.error('AI user not found. Please:');
    console.error('1. Go to Supabase Dashboard → Authentication → Users');
    console.error('2. Create user with email: ai@committed.app');
    console.error('3. Run create-ai-user.sql in Supabase SQL Editor');
    return null;
  } catch (error: any) {
    console.error('Error getting/creating AI user:', error);
    return null;
  }
}

/**
 * Generate image using DALL-E API
 */
async function generateImage(prompt: string): Promise<AIResponse> {
  try {
    // @ts-ignore - process.env is available in Expo at build time
    const openaiApiKey = process.env?.EXPO_PUBLIC_OPENAI_API_KEY || 
                        process.env?.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return {
        success: false,
        error: 'Image generation requires OpenAI API key. Please configure EXPO_PUBLIC_OPENAI_API_KEY.',
      };
    }

    // Clean up the prompt - remove common request phrases
    let cleanPrompt = prompt
      .replace(/generate (an? )?image (of|for|showing)/i, '')
      .replace(/create (an? )?(picture|image|photo) (of|for|showing)/i, '')
      .replace(/show me (an? )?(picture|image|photo) (of|for)/i, '')
      .replace(/draw (me )?(an? )?(picture|image) (of|for)/i, '')
      .replace(/make (an? )?(picture|image) (of|for)/i, '')
      .trim();

    if (!cleanPrompt) {
      cleanPrompt = prompt; // Fallback to original if cleaning removed everything
    }

    // Call DALL-E API
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: cleanPrompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `DALL-E API error: ${response.status}`);
    }

    const data = await response.json();
    const imageUrl = data.data[0]?.url;

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E');
    }

    // Upload image to Supabase storage
    const uploadedUrl = await uploadImageToStorage(imageUrl, cleanPrompt);

    return {
      success: true,
      message: `I've generated an image for you: "${cleanPrompt}"`,
      imageUrl: uploadedUrl,
      contentType: 'image',
    };
  } catch (error: any) {
    console.error('Image generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate image. Please try again.',
    };
  }
}

/**
 * Upload generated image to Supabase storage
 */
async function uploadImageToStorage(imageUrl: string, prompt: string): Promise<string> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate filename
    const timestamp = Date.now();
    const sanitizedPrompt = prompt.substring(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `ai-generated/${timestamp}_${sanitizedPrompt}.png`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('media')
      .upload(filename, uint8Array, {
        contentType: 'image/png',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading image to storage:', error);
      // Return original URL if upload fails
      return imageUrl;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    // Return original URL if upload fails
    return imageUrl;
  }
}

/**
 * Generate document (PDF/text) based on user request
 */
async function generateDocument(
  userRequest: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AIResponse> {
  try {
    // @ts-ignore - process.env is available in Expo at build time
    const openaiApiKey = process.env?.EXPO_PUBLIC_OPENAI_API_KEY || 
                        process.env?.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return {
        success: false,
        error: 'Document generation requires OpenAI API key. Please configure EXPO_PUBLIC_OPENAI_API_KEY.',
      };
    }

    // Determine document type and content
    const systemPrompt = `You are a professional document writer. Based on the user's request, generate a well-structured document. The document should be professional, clear, and comprehensive. Format it as plain text that can be converted to PDF. Include appropriate sections, headings, and content based on the document type requested.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-5), // Last 5 messages for context
      { role: 'user', content: `Please generate a document based on this request: ${userRequest}` },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const documentContent = data.choices[0]?.message?.content || '';

    if (!documentContent) {
      throw new Error('No document content generated');
    }

    // Determine document name from request
    let documentName = 'document.txt';
    if (userRequest.toLowerCase().includes('contract')) {
      documentName = 'contract.txt';
    } else if (userRequest.toLowerCase().includes('agreement')) {
      documentName = 'agreement.txt';
    } else if (userRequest.toLowerCase().includes('proposal')) {
      documentName = 'proposal.txt';
    } else if (userRequest.toLowerCase().includes('report')) {
      documentName = 'report.txt';
    } else if (userRequest.toLowerCase().includes('letter')) {
      documentName = 'letter.txt';
    }

    // Upload document to Supabase storage
    const documentUrl = await uploadDocumentToStorage(documentContent, documentName);

    return {
      success: true,
      message: `I've generated a ${documentName.replace('.txt', '')} for you. You can download it from the message.`,
      documentUrl: documentUrl,
      documentName: documentName,
      contentType: 'document',
    };
  } catch (error: any) {
    console.error('Document generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate document. Please try again.',
    };
  }
}

/**
 * Upload generated document to Supabase storage
 */
async function uploadDocumentToStorage(content: string, filename: string): Promise<string> {
  try {
    // Convert text to blob
    const blob = new Blob([content], { type: 'text/plain' });
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Generate storage filename
    const timestamp = Date.now();
    const storageFilename = `ai-documents/${timestamp}_${filename}`;

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('media')
      .upload(storageFilename, uint8Array, {
        contentType: 'text/plain',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading document to storage:', error);
      throw error;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(storageFilename);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}

/**
 * Get AI response using OpenAI API or fallback
 */
export async function getAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
): Promise<AIResponse> {
  try {
    // Check for image generation requests
    const imagePatterns = [
      /generate (an? )?image (of|for|showing)/i,
      /create (an? )?(picture|image|photo) (of|for|showing)/i,
      /show me (an? )?(picture|image|photo) (of|for)/i,
      /draw (me )?(an? )?(picture|image) (of|for)/i,
      /make (an? )?(picture|image) (of|for)/i,
    ];
    
    const isImageRequest = imagePatterns.some(pattern => pattern.test(userMessage));
    if (isImageRequest) {
      return await generateImage(userMessage);
    }

    // Check for document generation requests
    const documentPatterns = [
      /generate (an? )?document/i,
      /create (an? )?(document|pdf|contract|agreement|proposal|report)/i,
      /write (an? )?(document|contract|agreement|proposal|report)/i,
      /make (an? )?(document|pdf)/i,
    ];
    
    const isDocumentRequest = documentPatterns.some(pattern => pattern.test(userMessage));
    if (isDocumentRequest) {
      return await generateDocument(userMessage, conversationHistory);
    }

    // Check if OpenAI API key is configured
    // In React Native/Expo, process.env is available at build time
    // @ts-ignore - process.env is available in Expo at build time
    const openaiApiKey = process.env?.EXPO_PUBLIC_OPENAI_API_KEY || 
                        process.env?.OPENAI_API_KEY;

    if (openaiApiKey) {
      // Use OpenAI API
      const response = await getOpenAIResponse(userMessage, conversationHistory, openaiApiKey);
      
      // Check if response contains generation commands
      if (response.message?.startsWith('GENERATE_IMAGE:')) {
        const prompt = response.message.replace('GENERATE_IMAGE:', '').trim();
        return await generateImage(prompt || userMessage);
      }
      
      if (response.message?.startsWith('GENERATE_DOCUMENT:')) {
        const docInfo = response.message.replace('GENERATE_DOCUMENT:', '').trim();
        return await generateDocument(docInfo || userMessage, conversationHistory);
      }
      
      return response;
    } else {
      // Fallback to rule-based responses
      return getFallbackResponse(userMessage, conversationHistory);
    }
  } catch (error: any) {
    console.error('Error getting AI response:', error);
    return {
      success: false,
      error: error.message || 'Failed to get AI response',
    };
  }
}

/**
 * Get response from OpenAI API
 */
async function getOpenAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  apiKey: string
): Promise<AIResponse> {
  try {
    // Use the provided apiKey parameter (already resolved from process.env in getAIResponse)
    const systemPrompt = `You are Committed AI, a versatile, friendly, and supportive AI companion designed to help users with relationships, life advice, business guidance, and general companionship. You are:

- Warm, understanding, and non-judgmental
- Knowledgeable about relationships, communication, personal growth, and business
- Able to provide both emotional support and practical advice
- Respectful of boundaries and privacy
- Encouraging and positive while being realistic
- Business-savvy with knowledge of entrepreneurship, marketing, finance, strategy, and professional development

Respond naturally and conversationally, as if you're a trusted friend who genuinely cares. Keep responses concise but meaningful (2-4 sentences typically). Adapt your tone based on the user's needs - be a friend, companion, relationship advisor, life advisor, or business advisor as the situation requires.

When users ask for images (e.g., "generate an image of...", "create a picture of...", "show me..."), respond with just the text "GENERATE_IMAGE: [their prompt]" so the system can generate it.

When users ask for documents (e.g., "create a document", "write a...", "generate a PDF", "make a contract"), respond with just the text "GENERATE_DOCUMENT: [document type and content]" so the system can generate it.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: userMessage },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices[0]?.message?.content || 'I apologize, but I had trouble processing that. Could you try rephrasing?';

    return {
      success: true,
      message: aiMessage,
    };
  } catch (error: any) {
    console.error('OpenAI API error:', error);
    // Fallback to rule-based responses if API fails
    return getFallbackResponse(userMessage, conversationHistory);
  }
}

/**
 * Fallback rule-based responses when OpenAI is not available
 */
function getFallbackResponse(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): AIResponse {
  const message = userMessage.toLowerCase().trim();

  // Relationship advice patterns
  if (message.includes('relationship') || message.includes('partner') || message.includes('boyfriend') || message.includes('girlfriend') || message.includes('spouse')) {
    return {
      success: true,
      message: "Relationships require open communication and mutual respect. It's important to express your feelings honestly while also listening to your partner's perspective. Remember, every relationship has challenges, but working through them together can strengthen your bond. What specific aspect would you like to discuss?",
    };
  }

  // Breakup/conflict patterns
  if (message.includes('breakup') || message.includes('break up') || message.includes('fighting') || message.includes('argument')) {
    return {
      success: true,
      message: "I'm sorry you're going through a difficult time. Conflicts and breakups are painful, but they can also be opportunities for growth. Take time to process your emotions, and remember that it's okay to feel hurt. Would you like to talk more about what happened?",
    };
  }

  // Loneliness/sadness patterns
  if (message.includes('lonely') || message.includes('sad') || message.includes('depressed') || message.includes('down')) {
    return {
      success: true,
      message: "I hear you, and your feelings are valid. It's completely normal to feel this way sometimes. Remember that you're not alone, and there are people who care about you. Is there something specific that's been weighing on you?",
    };
  }

  // Greeting patterns
  if (message.includes('hello') || message.includes('hi') || message.includes('hey') || message.startsWith('h')) {
    return {
      success: true,
      message: "Hello! I'm Committed AI, your friendly companion here to help with relationships, life advice, or just to chat. What's on your mind today?",
    };
  }

  // Advice-seeking patterns
  if (message.includes('advice') || message.includes('help') || message.includes('what should') || message.includes('how do')) {
    return {
      success: true,
      message: "I'm here to help! Every situation is unique, so I'd love to understand more about what you're dealing with. Could you share a bit more detail? I'll do my best to provide thoughtful guidance.",
    };
  }

  // General positive response
  return {
    success: true,
    message: "Thank you for sharing that with me. I'm here to listen and help however I can. Whether you need relationship advice, someone to talk to, or just a friendly conversation, I'm here for you. What would you like to explore?",
  };
}

