import React, { useState, useRef, useEffect } from 'react';

interface ProfilePopupProps {
  user: any;
  onSignOut: () => Promise<void>;
}

const ProfilePopup: React.FC<ProfilePopupProps> = ({ user, onSignOut }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

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
    if (!user || !user.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <div className="relative" ref={popupRef}>
      <div 
        className="flex items-center space-x-3 cursor-pointer p-2 rounded-lg hover:bg-zinc-800/50"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm">
          {getUserInitials()}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">{user.email || 'User'}</div>
          <div className="text-xs text-gray-400">Free</div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-full bg-zinc-800 rounded-lg shadow-lg overflow-hidden animate-fade-in">
          <div className="p-3 border-b border-zinc-700">
            <div className="text-sm font-medium">{user.email}</div>
            <div className="text-xs text-gray-400">Free Account</div>
          </div>
          <div className="p-2">
            <button
              onClick={onSignOut}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-zinc-700 rounded-md"
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