'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import ChatComponent from '@/components/ChatComponent';
import LoginForm from '@/components/LoginForm';
import SignupForm from '@/components/SignupForm';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // Check if user is already authenticated
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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
        <ChatComponent userId={user.id} user={user} onSignOut={handleSignOut} />
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