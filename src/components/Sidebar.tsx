import React, { useState, useEffect, useRef, useCallback } from 'react';
import ProfilePopup from './ProfilePopup';
import ThemeToggle from './ThemeToggle';
import { Chat, getUserChats } from '@/lib/supabase';
import { useTheme } from './ThemeContext';

interface SidebarProps {
  onNewChat: () => void;
  user: any;
  userDisplayName?: string | null;
  onSignOut: () => Promise<void>;
  chats?: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onUpdateChatTitle?: (chatId: string, newTitle: string) => Promise<void>;
  onDeleteChat?: (chatId: string) => Promise<void>;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
  loadChats?: () => Promise<void>; // Optional prop for initial chat loading
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNewChat, 
  user, 
  userDisplayName,
  onSignOut, 
  chats: initialChats = [], 
  activeChatId,
  onSelectChat,
  onUpdateChatTitle,
  onDeleteChat,
  isMobileOpen = false,
  onMobileClose,
  loadChats
}) => {
  const { theme } = useTheme(); // Get current theme
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [offset, setOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  
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
  
  // Initialize with chats from props if available
  useEffect(() => {
    if (initialChats.length > 0) {
      // Clear any previously loaded chats to prevent duplication
      setChats(initialChats);
      setOffset(initialChats.length);
    } else {
      // Only load chats if we don't have any and initialChats is empty
      if (chats.length === 0) {
        loadMoreChats();
      }
    }
  }, [initialChats, chats.length]); // Removing loadMoreChats from dependencies to avoid circular dependency
  
  // Load more chats when scrolling
  const loadMoreChats = useCallback(async () => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    try {
      const limit = 50;
      const newChats = await getUserChats(limit, offset);
      
      if (newChats.length === 0) {
        setHasMore(false);
      } else {
        setChats(prevChats => [...prevChats, ...newChats]);
        setOffset(prevOffset => prevOffset + newChats.length);
      }
    } catch (error) {
      console.error('Error loading more chats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [offset, isLoading, hasMore]);
  
  // Setup intersection observer for infinite scrolling
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMoreChats();
        }
      },
      { threshold: 0.1 }
    );
    
    observerRef.current = observer;
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreChats, hasMore, isLoading]);
  
  // Attach observer to the loading element
  useEffect(() => {
    if (loadingRef.current && observerRef.current) {
      observerRef.current.observe(loadingRef.current);
    }
    
    return () => {
      if (loadingRef.current && observerRef.current) {
        observerRef.current.unobserve(loadingRef.current);
      }
    };
  }, [loadingRef.current, observerRef.current]);
  
  // Reset closing state when sidebar opens
  useEffect(() => {
    if (isMobileOpen) {
      setIsClosing(false);
    }
  }, [isMobileOpen]);
  
  // Group chats by recency based on latest_chat_timestamp
  const groupedChats = {
    recent: [] as Chat[],
    older: [] as Chat[]
  };
  
  // Calculate date for two days ago
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  
  chats.forEach(chat => {
    // Use latest_chat_timestamp instead of created_at
    const chatTimestamp = new Date(chat.latest_chat_timestamp || chat.created_at);
    
    if (chatTimestamp >= twoDaysAgo) {
      groupedChats.recent.push(chat);
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
    const isActive = activeChatId === chat.chatId;
    
    if (isEditing) {
      return (
        <input
          type="text"
          className={`w-full px-2 py-1 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 ${
            theme === 'dark' 
              ? 'bg-zinc-700 border border-zinc-600 text-white' 
              : 'bg-white border border-zinc-300 text-gray-800'
          }`}
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
        className={`group flex items-center justify-between px-2 py-2 text-sm rounded-lg 
          ${theme === 'dark'
            ? 'hover:bg-zinc-800/50'
            : 'hover:bg-purple-100/50'
          }
          ${isActive 
            ? theme === 'dark'
              ? 'bg-zinc-800 text-white' 
              : 'bg-purple-100 text-purple-900'
            : theme === 'dark'
              ? 'text-gray-300'
              : 'text-gray-800'
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
            className={`opacity-0 group-hover:opacity-100 p-1 transition-all duration-200 ${
              theme === 'dark'
                ? 'text-zinc-500 hover:text-red-400'
                : 'text-zinc-400 hover:text-red-500'
            }`}
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
  const sidebarClasses = `sidebar h-screen w-60 md:w-60 flex flex-col ${theme === 'dark' ? 'border-r border-zinc-800' : 'border-r border-zinc-200'} 
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
        <div className={`flex items-center justify-between h-14 px-4 ${theme === 'dark' ? 'border-b border-zinc-800' : 'border-b border-zinc-200'}`}>
          <h1 className="font-bold text-xl">Orchestrate</h1>
          <div className="flex items-center">
            <ThemeToggle className="mr-3" />
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
        </div>
        
        <div className="p-3">
          <button 
            onClick={onNewChat}
            className="new-chat-button w-full mb-4"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(88, 28, 135, 0.6)' : 'rgba(107, 70, 193, 0.8)',
              color: 'white',
              fontWeight: '500',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: theme === 'dark' ? '1px solid rgba(126, 34, 206, 0.5)' : '1px solid rgba(126, 34, 206, 0.7)',
              transition: 'background-color 200ms'
            }}
          >
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Recent chats */}
          {groupedChats.recent.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1 text-xs font-medium text-zinc-500">
                Recent
              </div>
              <div className="space-y-1 mt-1">
                {groupedChats.recent.map((chat, index) => (
                  <div key={`recent-${chat.chatId}-${index}`}>
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
                {groupedChats.older.map((chat, index) => (
                  <div key={`older-${chat.chatId}-${index}`}>
                    {renderChatItem(chat)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div ref={loadingRef} className="h-10 flex items-center justify-center text-sm text-zinc-500">
          {isLoading && 'Loading more chats...'}
        </div>
        
        {/* User profile at bottom of sidebar */}
        <div className={`mt-auto p-3 ${theme === 'dark' ? 'border-t border-zinc-800' : 'border-t border-zinc-200'}`}>
          <ProfilePopup user={user} userDisplayName={userDisplayName} onSignOut={onSignOut} />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
