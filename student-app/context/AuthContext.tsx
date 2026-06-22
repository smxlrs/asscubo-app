import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';

type Profile = {
  id: string;
  name: string | null;
  student_id: string | null;
  faculty: string | null;
  major: string | null;
  campus: string | null;
  role: 'student' | 'admin' | 'super_admin';
  avatar_url: string | null;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, currentUser?: User | null) {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!error && data) {
        let currentProfile = data as Profile;
        
        // Sync missing profile name from auth user metadata if RLS blocked upsert during signup
        const metaName = currentUser?.user_metadata?.name;
        if (!currentProfile.name && metaName) {
          const { data: updatedData, error: updateError } = await supabase
            .from('profiles')
            .update({ name: metaName })
            .eq('id', userId)
            .select()
            .single();
          
          if (!updateError && updatedData) {
            currentProfile = updatedData as Profile;
          }
        }
        
        setProfile(currentProfile);
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signUp(email: string, password: string, name: string) {
    // 1. Sign up the user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password, 
      options: { 
        data: { name },
        emailRedirectTo: Linking.createURL('login-callback') // Redirect back to App dynamically after verification
      } 
    });
    
    if (error) return { error };

    // 2. Insert into the profile table if auto-trigger didn't run or to ensure it is populated
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        name: name,
        role: 'student'
      });
      if (profileError) {
        console.error('Error writing profile:', profileError);
      }
    }
    return { error: null };
  }

  async function signOut() { 
    await supabase.auth.signOut(); 
  }

  async function refreshProfile() { 
    if (user) await fetchProfile(user.id, user); 
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
