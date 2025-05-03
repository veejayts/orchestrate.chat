import React, { useState, useEffect } from 'react';
import ProfilePopup from './ProfilePopup';
import { Chat } from '@/lib/supabase';

interface SidebarProps {
  onNewChat: () => void;
  user: any;
  onSignOut: () => Promise<void>;
  chats?: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onUpdateChatTitle?: (chatId: string, newTitle: string) => Promise<void>;
  onDeleteChat?: (chatId: string) => Promise<void>;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, 
  user, 
  onSignOut, 
  chats = [], 
  activeChatId,
  onSelectChat,
  onUpdateChatTitle,
  onDeleteChat,
  isMobileOpen = false,
  onMobileClose
}) => {
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  // Track animation state to handle dismiss animation properly
  const [isClosing, setIsClosing] = useState(false);
  
  // Handle close animation
  const handleClose = () => {
    if (onMobileClose && isMobileOpen) {
      setIsClosing(true);
      setTimeout(() => {
        setIsClosing(false);
        onMobileClose();
      }, 300); // Match animation duration
    }
  };
  
  // Reset closing state when sidebar opens
  useEffect(() => {
    if (isMobileOpen) {
      setIsClosing(false);
    }
  }, [isMobileOpen]);
  
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

  // Close sidebar on mobile when chat is selected
  const handleSelectChat = (chatId: string) => {
    onSelectChat(chatId);
    if (window.innerWidth < 768 && onMobileClose) {
      handleClose();
    }
  };

  const handleDoubleClick = (chat: Chat) => {
    if (!onUpdateChatTitle) return;
    setEditingChatId(chat.chatId);
    setEditingTitle(chat.title);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingTitle(e.target.value);
  };

  const handleTitleBlur = async () => {
    if (editingChatId && editingTitle.trim() !== '' && onUpdateChatTitle) {
      await onUpdateChatTitle(editingChatId, editingTitle);
    }
    setEditingChatId(null);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingChatId(null);
    }
  };

  const renderChatItem = (chat: Chat) => {
    const isEditing = chat.chatId === editingChatId;
    
    if (isEditing) {
      return (
        <input
          type="text"
          className="w-full px-2 py-1 bg-zinc-700 border border-zinc-600 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
          value={editingTitle}
          onChange={handleTitleChange}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          autoFocus
        />
      );
    }

    return (
      <div 
        className={`group flex items-center justify-between px-2 py-2 text-sm rounded-lg hover:bg-zinc-800/50 ${
          activeChatId === chat.chatId ? 'bg-zinc-800' : ''
        }`}
      >
        <div 
          className="flex-1 overflow-hidden text-ellipsis cursor-pointer"
          onClick={() => handleSelectChat(chat.chatId)}
          onDoubleClick={() => handleDoubleClick(chat)}
        >
          {chat.title}
        </div>
        {onDeleteChat && (
          <button
            className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all duration-200 p-1"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
                onDeleteChat(chat.chatId);
              }
            }}
            aria-label="Delete chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>
    );
  };

  // Updated sidebar classes with animation
  const sidebarClasses = `sidebar h-screen w-60 md:w-60 flex flex-col border-r border-zinc-800 
    ${isMobileOpen || isClosing
      ? 'fixed md:relative z-50 w-3/4' 
      : 'hidden md:flex'
    } ${isMobileOpen && !isClosing ? 'animate-slide-in' : ''} ${isClosing ? 'animate-slide-out' : ''}`;

  return (
    <>
      {/* Overlay for mobile when sidebar is open with fade animation */}
      {(isMobileOpen || isClosing) && (
        <div 
          className={`fixed inset-0 bg-black z-40 md:hidden ${isClosing ? 'animate-fade-out' : 'animate-fade-in-overlay'}`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleClose}
        />
      )}

      <div className={sidebarClasses}>
        <div className="flex items-center justify-between h-14 px-4 border-b border-zinc-800">
          <h1 className="font-bold text-xl">Orchestrate</h1>
          <button 
            onClick={handleClose}
            className="md:hidden text-gray-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
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
                  <div key={chat.chatId}>
                    {renderChatItem(chat)}
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
                  <div key={chat.chatId}>
                    {renderChatItem(chat)}
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
                  <div key={chat.chatId}>
                    {renderChatItem(chat)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-zinc-800">
          <div className="flex items-center justify-between">
            <ProfilePopup user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
