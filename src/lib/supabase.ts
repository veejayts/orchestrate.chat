import { createClient } from '@supabase/supabase-js';
import { ChatMessage } from './openrouter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Configure Supabase client with persistent sessions
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'orchestrate-chat-auth',
    storage: {
      getItem: (key) => {
        if (typeof window !== 'undefined') {
          return JSON.parse(localStorage.getItem(key) || 'null');
        }
        return null;
      },
      setItem: (key, value) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem(key, JSON.stringify(value));
        }
      },
      removeItem: (key) => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(key);
        }
      },
    },
  },
  // Global settings for storing cookies across the entire site
  global: {
    headers: {
      'X-Client-Info': 'orchestrate-chat'
    },
  },
});

// Chat database functions
export interface Chat {
  chatId: string;
  title: string;
  created_at: string;
  user_id?: string;
  latest_chat_timestamp?: string;
}

export interface ChatMessageDB {
  messageid?: string;
  chatid: string;
  message: string;
  source: string;
  created_at?: string;
}

// Helper function to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Create a new chat and return the chatId
export async function createChat(title: string = 'New Chat'): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('chats_meta')
      .insert([{ title, user_id: userId }])
      .select('chatid');
    
    if (error) throw error;
    
    return data && data[0] ? data[0].chatid : null;
  } catch (error) {
    console.error('Error creating chat:', error);
    return null;
  }
}

// Save a message to the database
export async function saveMessage(
  chatId: string, 
  message: string, 
  source: string
): Promise<string | null> {
  try {
    // Get the user ID
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User not authenticated');
      return null;
    }
    
    // First verify this user owns the chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats_meta')
      .select('chatid')
      .eq('chatid', chatId)
      .eq('user_id', userId)
      .single();
    
    if (chatError || !chatData) {
      console.error('Chat not found or user does not have access', chatError);
      return null;
    }
    
    // Now insert the message
    const { data, error } = await supabase
      .from('chats')
      .insert([{ chatid: chatId, message, source }])
      .select('messageid');
    
    if (error) {
      console.error('Error inserting message:', error);
      throw error;
    }
    
    return data && data[0] ? data[0].messageid : null;
  } catch (error) {
    console.error('Error saving message:', error);
    return null;
  }
}

// Save a message to the database with streaming support
export async function saveStreamingMessage(
  chatId: string,
  initialContent: string,
  source: string
): Promise<string | null> {
  try {
    // Get the user ID
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User not authenticated');
      return null;
    }
    
    // First verify this user owns the chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats_meta')
      .select('chatid')
      .eq('chatid', chatId)
      .eq('user_id', userId)
      .single();
    
    if (chatError || !chatData) {
      console.error('Chat not found or user does not have access', chatError);
      return null;
    }
    
    // Now insert the message
    const { data, error } = await supabase
      .from('chats')
      .insert([{ chatid: chatId, message: initialContent, source }])
      .select('messageid');
    
    if (error) {
      console.error('Error inserting streaming message:', error);
      throw error;
    }
    
    return data && data[0] ? data[0].messageid : null;
  } catch (error) {
    console.error('Error saving streaming message:', error);
    return null;
  }
}

// Update an existing streaming message with additional content
export async function updateStreamingMessage(
  messageId: string,
  content: string
): Promise<boolean> {
  try {
    // Get the user ID
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User not authenticated');
      return false;
    }
    
    // First verify this user owns the chat that contains this message
    const { data: messageData, error: messageError } = await supabase
      .from('chats')
      .select('chatid')
      .eq('messageid', messageId)
      .single();
    
    if (messageError || !messageData) {
      console.error('Message not found', messageError);
      return false;
    }
    
    // Now verify the user owns the chat
    const { data: chatData, error: chatError } = await supabase
      .from('chats_meta')
      .select('chatid')
      .eq('chatid', messageData.chatid)
      .eq('user_id', userId)
      .single();
    
    if (chatError || !chatData) {
      console.error('Chat not found or user does not have access', chatError);
      return false;
    }
    
    // Now update the message
    const { error } = await supabase
      .from('chats')
      .update({ message: content })
      .eq('messageid', messageId);
    
    if (error) {
      console.error('Error updating message:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating streaming message:', error);
    return false;
  }
}

// Get all messages for a chat
export async function getChatMessages(chatId: string): Promise<ChatMessageDB[]> {
  try {
    // RLS policies will handle access control
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('chatid', chatId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
}

// Get all chats for the current user
export async function getUserChats(limit: number = 30, offset: number = 0): Promise<Chat[]> {
  try {
    // RLS policies will automatically filter to only show the current user's chats
    const { data, error } = await supabase
      .from('chats_meta')
      .select('*')
      .order('latest_chat_timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) throw error;
    
    return data?.map(chat => ({
      chatId: chat.chatid,
      title: chat.title,
      created_at: chat.created_at,
      user_id: chat.user_id,
      latest_chat_timestamp: chat.latest_chat_timestamp
    })) || [];
  } catch (error) {
    console.error('Error getting user chats:', error);
    return [];
  }
}

// Update the chat title
export async function updateChatTitle(chatId: string, title: string): Promise<boolean> {
  try {
    // RLS policies will handle access control
    const { error } = await supabase
      .from('chats_meta')
      .update({ title })
      .eq('chatid', chatId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error updating chat title:', error);
    return false;
  }
}

// Delete a chat and all its messages
export async function deleteChat(chatId: string): Promise<boolean> {
  try {
    // First delete all chat messages
    // RLS policies will handle access control
    const { error: messagesError } = await supabase
      .from('chats')
      .delete()
      .eq('chatid', chatId);
    
    if (messagesError) throw messagesError;
    
    // Then delete the chat metadata
    // RLS policies will handle access control
    const { error: metaError } = await supabase
      .from('chats_meta')
      .delete()
      .eq('chatid', chatId);
    
    if (metaError) throw metaError;
    
    return true;
  } catch (error) {
    console.error('Error deleting chat:', error);
    return false;
  }
}

// Delete a single message
export async function deleteMessage(messageId: string): Promise<boolean> {
  // Don't attempt to delete if messageId is undefined or empty
  if (!messageId || messageId === 'undefined') {
    console.error('Invalid message ID for deletion');
    return false;
  }

  try {
    // RLS policies will handle access control
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('messageid', messageId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error deleting message:', error);
    return false;
  }
}

// Get user's OpenRouter API key
export async function getUserOpenRouterApiKey(): Promise<string | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      console.error('User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('user')
      .select('openrouter_api_key')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user API key:', error);
      return null;
    }
    
    return data?.openrouter_api_key || null;
  } catch (error) {
    console.error('Error getting user API key:', error);
    return null;
  }
}