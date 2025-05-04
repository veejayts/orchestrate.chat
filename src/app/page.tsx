'use client';

import { useEffect, useState } from 'react';
import { supabase, getUserDisplayName } from '@/lib/supabase';
import ChatComponent from '@/components/ChatComponent';
import LoginForm from '@/components/LoginForm';
import SignupForm from '@/components/SignupForm';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already authenticated
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Fetch user display name once when authenticated
        const displayName = await getUserDisplayName();
        setUserDisplayName(displayName);
      }
      
      setLoading(false);
    };

    getUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      
      if (newUser) {
        // Update display name when auth state changes (login)
        const displayName = await getUserDisplayName();
        setUserDisplayName(displayName);
      } else {
        // Clear display name on logout
        setUserDisplayName(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      {user ? (
        <ChatComponent 
          userId={user.id} 
          user={user} 
          userDisplayName={userDisplayName}
          onSignOut={handleSignOut} 
        />
      ) : (
        <div className="min-h-screen flex items-center justify-center p-4">
          {authView === 'login' ? (
            <LoginForm setAuthView={setAuthView} />
          ) : (
            <SignupForm setAuthView={setAuthView} />
          )}
        </div>
      )}
    </main>
  );
}