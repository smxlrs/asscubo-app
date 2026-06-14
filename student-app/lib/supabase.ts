import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Use SecureStore for persistent auth sessions on device
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          student_id: string | null;
          name: string | null;
          faculty: string | null;
          major: string | null;
          campus: string | null;
          enrollment_year: number | null;
          role: 'student' | 'admin' | 'super_admin';
          avatar_url: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      articles: {
        Row: {
          id: string;
          title: string;
          content: string;
          category: string;
          cover_image: string | null;
          author_id: string;
          is_published: boolean;
          push_sent: boolean;
          view_count: number;
          created_at: string;
          updated_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string;
          location: string;
          start_time: string;
          end_time: string;
          max_participants: number | null;
          cover_image: string | null;
          is_published: boolean;
          created_at: string;
        };
      };
      event_registrations: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          registered_at: string;
          status: 'confirmed' | 'cancelled' | 'waitlist';
        };
      };
      handbook_chapters: {
        Row: {
          id: string;
          title: string;
          order_index: number;
          content_type: 'pdf' | 'richtext';
          content_url: string | null;
          content_body: string | null;
          parent_id: string | null;
          is_published: boolean;
          created_at: string;
        };
      };
      community_posts: {
        Row: {
          id: string;
          group_type: 'faculty' | 'year' | 'campus' | 'general';
          group_value: string;
          author_id: string;
          title: string;
          content: string;
          reply_count: number;
          created_at: string;
        };
      };
      post_replies: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          title: string;
          body: string;
          target_type: 'all' | 'faculty' | 'year' | 'campus';
          target_value: string | null;
          sent_at: string;
          article_id: string | null;
        };
      };
    };
  };
};
