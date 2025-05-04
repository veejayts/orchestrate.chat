import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';

interface ProfilePopupProps {
  user: any;
  onSignOut: () => Promise<void>;
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const [username, setUsername] = useState<string | null>(null);

  // Fetch username from the database when component mounts
  useEffect(() => {
    const fetchUsername = async () => {
      if (user?.id) {
        // Dynamically import supabase client to avoid SSR issues
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('user')
          .select('username')
          .eq('user_id', user.id)
          .single();
        
        if (!error && data) {
          setUsername(data.username);
        }
      }
    };

    fetchUsername();
  }, [user]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get user initials for avatar
  const getUserInitials = () => {
    if (username) {
      return username.charAt(0).toUpperCase();
    }
    if (!user || !user.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  // Display username or email in the header
  const getDisplayName = () => {
    return username || user.email || 'User';
  };

  return (
    <div className="relative" ref={popupRef}>
      <div 
        className={`flex items-center space-x-3 cursor-pointer p-2 rounded-lg ${
          theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-purple-100/50'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
          {getUserInitials()}
        </div>
        <div className="flex-1">
          <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{getDisplayName()}</div>
          <div className="text-xs text-gray-400">Free</div>
        </div>
      </div>

      {isOpen && (
        <div className={`absolute bottom-full left-0 mb-2 w-full rounded-lg shadow-lg overflow-hidden animate-fade-in z-50 ${
          theme === 'dark' ? 'bg-zinc-800' : 'bg-white border border-zinc-200'
        }`}>
          <div className={`p-3 ${theme === 'dark' ? 'border-b border-zinc-700' : 'border-b border-zinc-200'}`}>
            <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
              {username && <div>{username}</div>}
              <div className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>{user.email}</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">Free Account</div>
          </div>
          <div className="p-2">
            <button
              onClick={onSignOut}
              className={`w-full text-left px-3 py-2 text-sm rounded-md ${
                theme === 'dark' 
                  ? 'text-gray-300 hover:bg-zinc-700' 
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePopup;