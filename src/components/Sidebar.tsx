import React, { useState } from 'react';
import ProfilePopup from './ProfilePopup';
import { Chat } from '@/lib/supabase';

interface SidebarProps {
  onNewChat: () => void;
  user: any;
  onSignOut: () => Promise<void>;
  chats?: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, 
  user, 
  onSignOut, 
  chats = [], 
  activeChatId,
  onSelectChat
}) => {
  // Get today and yesterday dates for grouping
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Format dates for comparison
  const todayStr = today.toDateString();
  const yesterdayStr = yesterday.toDateString();
  
  // Group chats by date
  const groupedChats = {
    today: [] as Chat[],
    yesterday: [] as Chat[],
    older: [] as Chat[]
  };
  
  chats.forEach(chat => {
    const chatDate = new Date(chat.created_at);
    if (chatDate.toDateString() === todayStr) {
      groupedChats.today.push(chat);
    } else if (chatDate.toDateString() === yesterdayStr) {
      groupedChats.yesterday.push(chat);
    } else {
      groupedChats.older.push(chat);
    }
  });

  return (
    <div className="sidebar h-screen w-60 flex flex-col border-r border-zinc-800">
      <div className="flex items-center h-14 px-4 border-b border-zinc-800">
        <h1 className="font-bold text-xl">Orchestrate.chat</h1>
      </div>
      
      <div className="p-3">
        <button 
          onClick={onNewChat}
          className="new-chat-button w-full mb-4"
          style={{
            backgroundColor: 'rgba(88, 28, 135, 0.6)', // bg-purple-900/60
            color: 'white',
            fontWeight: '500',
            padding: '0.75rem 1rem',
            borderRadius: '0.375rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(126, 34, 206, 0.5)', // border-purple-700/50
            transition: 'background-color 200ms'
          }}
        >
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Today's chats */}
        {groupedChats.today.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-zinc-500">
              Today
            </div>
            <div className="space-y-1 mt-1">
              {groupedChats.today.map(chat => (
                <div 
                  key={chat.chatId} 
                  className={`px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer ${
                    activeChatId === chat.chatId ? 'bg-zinc-800' : ''
                  }`}
                  onClick={() => onSelectChat(chat.chatId)}
                >
                  {chat.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Yesterday's chats */}
        {groupedChats.yesterday.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-zinc-500">
              Yesterday
            </div>
            <div className="space-y-1 mt-1">
              {groupedChats.yesterday.map(chat => (
                <div 
                  key={chat.chatId} 
                  className={`px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer ${
                    activeChatId === chat.chatId ? 'bg-zinc-800' : ''
                  }`}
                  onClick={() => onSelectChat(chat.chatId)}
                >
                  {chat.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Older chats */}
        {groupedChats.older.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-zinc-500">
              Older
            </div>
            <div className="space-y-1 mt-1">
              {groupedChats.older.map(chat => (
                <div 
                  key={chat.chatId} 
                  className={`px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer ${
                    activeChatId === chat.chatId ? 'bg-zinc-800' : ''
                  }`}
                  onClick={() => onSelectChat(chat.chatId)}
                >
                  {chat.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show default items if no chats */}
        {chats.length === 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-xs font-medium text-zinc-500">
              Older
            </div>
            <div className="space-y-1 mt-1">
              <div className="px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer">
                Welcome to Orchestrate Chat
              </div>
              <div className="px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer">
                How to use AI effectively
              </div>
              <div className="px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 cursor-pointer">
                FAQ
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <ProfilePopup user={user} onSignOut={onSignOut} />
      </div>
    </div>
  );
};

export default Sidebar;
