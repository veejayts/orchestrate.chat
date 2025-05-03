import { createClient } from '@supabase/supabase-js';
import { ChatMessage } from './openrouter';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Chat database functions
export interface Chat {
  chatId: string;
  title: string;
  created_at: string;
}

export interface ChatMessageDB {
  messageId?: string;
  chatId: string;
  message: string;
  source: string;
  created_at?: string;
}

// Create a new chat and return the chatId
export async function createChat(title: string = 'New Chat'): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('chats_meta')
      .insert([{ title }])
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
    const { data, error } = await supabase
      .from('chats')
      .insert([{ chatid: chatId, message, source }])
      .select('messageid');
    
    if (error) throw error;
    
    return data && data[0] ? data[0].messageid : null;
  } catch (error) {
    console.error('Error saving message:', error);
    return null;
  }
}

// Get all messages for a chat
export async function getChatMessages(chatId: string): Promise<ChatMessageDB[]> {
  try {
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

// Get all chats for a user
export async function getUserChats(): Promise<Chat[]> {
  try {
    const { data, error } = await supabase
      .from('chats_meta')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return data?.map(chat => ({
      chatId: chat.chatid,
      title: chat.title,
      created_at: chat.created_at
    })) || [];
  } catch (error) {
    console.error('Error getting user chats:', error);
    return [];
  }
}

// Convert database messages to the format expected by OpenRouter
export function dbMessagesToChatMessages(messages: ChatMessageDB[]): ChatMessage[] {
  return messages.map(msg => ({
    role: msg.source === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
    content: msg.message
  }));
}

// Update the chat title
export async function updateChatTitle(chatId: string, title: string): Promise<boolean> {
  try {
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