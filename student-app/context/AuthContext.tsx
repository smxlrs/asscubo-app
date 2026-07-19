import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { recordDebugEvent } from '../lib/logger';
import * as Linking from 'expo-linking';
import { AppState } from 'react-native';

const AUTH_TIMEOUT_MS = 5000;

function getEmailDomain(email: string) {
  const domain = email.trim().split('@')[1];
  return domain ? domain.toLowerCase() : 'invalid';
}

/** 给任意 Promise 加超时，超时时 resolve(null) 而非 reject，防止崩溃 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

type Profile = {
  id: string;
  name: string | null;
  student_id: string | null;
  faculty: string | null;
  major: string | null;
  campus: string | null;
  role: 'student' | 'admin' | 'super_admin';
  avatar_url: string | null;
  is_banned: boolean;
};

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  networkError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any; alreadyExists: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  retryInit: () => void;
  hasUnreadFeedbackReply: boolean;
  refreshUnreadFeedbackReplies: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNetworkError(false);

    async function init() {
      // getSession 读本地缓存，加超时保险
      const result = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS);

      if (cancelled) return;

      if (result === null) {
        // 超时：放行开屏，显示离线提示
        setNetworkError(true);
        setLoading(false);
        return;
      }

      const { data: { session } } = result;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id, session.user, cancelled);
      } else {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user, false);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [retryKey]);

  async function fetchProfile(userId: string, currentUser?: User | null, cancelled = false) {
    try {
      const result = await withTimeout(
        Promise.resolve(supabase.from('profiles').select('*').eq('id', userId).single()),
        AUTH_TIMEOUT_MS
      );

      if (cancelled) return;

      if (result === null) {
        setNetworkError(true);
        return;
      }

      const { data, error } = result as any;
      if (!error && data) {
        let currentProfile = data as Profile;
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
      if (!cancelled) setNetworkError(true);
    } finally {
      if (!cancelled) setLoading(false);
    }
  }

  function retryInit() {
    setRetryKey((k) => k + 1);
  }

  async function signIn(email: string, password: string) {
    recordDebugEvent('auth', 'Sign-in requested', { emailDomain: getEmailDomain(email) });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    recordDebugEvent(
      'auth',
      error ? 'Sign-in rejected' : 'Sign-in completed',
      error ? { emailDomain: getEmailDomain(email), error: error.message, code: error.code } : { emailDomain: getEmailDomain(email) },
      error ? 'warn' : 'log'
    );
    return { error };
  }

  async function signUp(email: string, password: string, name: string) {
    recordDebugEvent('auth', 'Sign-up requested', { emailDomain: getEmailDomain(email) });
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: 'https://asscubo.it/verified.html'
      }
    });
    if (error) {
      recordDebugEvent('auth', 'Sign-up rejected', { emailDomain: getEmailDomain(email), error: error.message, code: error.code }, 'warn');
      return { error, alreadyExists: false };
    }

    // With email confirmation enabled, Supabase intentionally returns a successful
    // response for an existing address. An empty identities list is its signal that
    // no new account was created, so never upsert that user's profile.
    if (data.user?.identities?.length === 0) {
      recordDebugEvent('auth', 'Sign-up found existing account', { emailDomain: getEmailDomain(email) }, 'warn');
      return { error: null, alreadyExists: true };
    }

    // The database trigger creates profiles as auth.users is inserted. With email
    // confirmation enabled there is no authenticated session yet, so a client-side
    // insert would correctly be rejected by profiles RLS.
    recordDebugEvent('auth', 'Sign-up completed', { emailDomain: getEmailDomain(email) });
    return { error: null, alreadyExists: false };
  }

  async function signOut() {
    recordDebugEvent('auth', 'Sign-out requested');
    if (user?.id) {
      try {
        await supabase.from('profiles').update({ push_token: null }).eq('id', user.id);
      } catch (err) {
        console.warn('Failed to clear push token during signOut:', err);
      }
    }
    await supabase.auth.signOut();
    recordDebugEvent('auth', 'Sign-out completed');
  }

  const [hasUnreadFeedbackReply, setHasUnreadFeedbackReply] = useState(false);

  async function refreshUnreadFeedbackReplies() {
    if (!user) {
      setHasUnreadFeedbackReply(false);
      return;
    }
    try {
      const { count, error } = await supabase
        .from('feedbacks')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .not('reply', 'is', null)
        .eq('user_viewed_reply', false);

      if (error) throw error;
      setHasUnreadFeedbackReply(count ? count > 0 : false);
    } catch (err) {
      console.warn('Failed to check unread feedback replies:', err);
    }
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id, user);
  }

  useEffect(() => {
    if (user) {
      refreshUnreadFeedbackReplies();
    } else {
      setHasUnreadFeedbackReply(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        refreshProfile();
        refreshUnreadFeedbackReplies();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      loading, 
      networkError, 
      signIn, 
      signUp, 
      signOut, 
      refreshProfile, 
      retryInit,
      hasUnreadFeedbackReply,
      refreshUnreadFeedbackReplies
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
