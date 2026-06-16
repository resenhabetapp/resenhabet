import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const linkPendingGuess = async (userId: string) => {
    const pendingGuessId = localStorage.getItem('pending_guess_id');
    if (pendingGuessId) {
      try {
        const { error } = await supabase
          .from('guesses')
          .update({ user_id: userId })
          .eq('id', pendingGuessId);
        if (!error) {
          localStorage.removeItem('pending_guess_id');
          console.log('Successfully linked pending guess to user:', userId);
        } else {
          console.error('Error linking pending guess:', error);
        }
      } catch (err) {
        console.error('Unexpected error linking pending guess:', err);
      }
    }
  };

  useEffect(() => {
    // Fetch active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        linkPendingGuess(currentUser.id);
      }
      setLoading(false);
    });

    // Listen to auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        linkPendingGuess(currentUser.id);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
