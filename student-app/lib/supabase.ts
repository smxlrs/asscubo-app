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

type Language = 'zh' | 'zh-Hant' | 'en' | 'it';

const errorTranslations: Record<Language, Record<string, string>> = {
  zh: {
    invalid_credentials: '邮箱或密码错误，请重新输入',
    email_not_confirmed: '您的邮箱尚未验证，请查收激活邮件',
    user_not_found: '该用户不存在',
    user_already_exists: '该邮箱已被注册，请直接登录',
    rate_limit_exceeded: '请求过于频繁，请稍后再试',
    network_failed: '网络请求失败，请检查网络连接',
    password_too_short: '密码长度不能少于 6 位',
    signup_requires_confirmation: '注册需要邮箱验证，请查收邮件完成验证',
    invalid_email: '邮箱格式不正确，请重新输入',
    credentials_required: '请输入邮箱和密码',
    fallback: '操作失败，请重试',
  },
  'zh-Hant': {
    invalid_credentials: '郵箱或密碼錯誤，請重新輸入',
    email_not_confirmed: '您的郵箱尚未驗證，請查收激活郵件',
    user_not_found: '該用戶不存在',
    user_already_exists: '該郵箱已被註冊，請直接登錄',
    rate_limit_exceeded: '請求過於頻繁，請稍後再試',
    network_failed: '網絡請求失敗，請檢查網絡連接',
    password_too_short: '密碼長度不能少於 6 位',
    signup_requires_confirmation: '註冊需要郵箱驗證，請查收郵件完成驗證',
    invalid_email: '郵箱格式不正確，請重新輸入',
    credentials_required: '請輸入郵箱和密碼',
    fallback: '操作失敗，請重試',
  },
  en: {
    invalid_credentials: 'Invalid email or password',
    email_not_confirmed: 'Your email has not been verified, please check your inbox',
    user_not_found: 'User not found',
    user_already_exists: 'This email is already registered, please login directly',
    rate_limit_exceeded: 'Too many requests, please try again later',
    network_failed: 'Network request failed, please check your internet connection',
    password_too_short: 'Password should be at least 6 characters',
    signup_requires_confirmation: 'Registration requires email verification, please check your inbox',
    invalid_email: 'Invalid email format, please try again',
    credentials_required: 'Please enter your email and password',
    fallback: 'Operation failed, please try again',
  },
  it: {
    invalid_credentials: 'E-mail o password non corretta',
    email_not_confirmed: 'La tua e-mail non è stata verificata, controlla la tua casella di posta',
    user_not_found: 'Utente non trovato',
    user_already_exists: 'Questa e-mail è già registrata, accedi direttamente',
    rate_limit_exceeded: 'Troppe richieste, riprova più tardi',
    network_failed: 'Richiesta di rete fallita, verifica la tua connessione internet',
    password_too_short: 'La password deve contenere almeno 6 caratteri',
    signup_requires_confirmation: 'La registrazione richiede la verifica e-mail, controlla la tua casella di posta',
    invalid_email: 'Formato e-mail non valido, riprova',
    credentials_required: 'Si prega di inserire email e password',
    fallback: 'Operazione fallita, riprova',
  },
};

/**
 * Translates Supabase auth error messages into the specified language.
 */
export function translateAuthError(message: string, lang: Language = 'zh'): string {
  if (!message) return errorTranslations[lang]?.fallback || '操作失败，请重试';
  
  const msgLower = message.toLowerCase();
  const dict = errorTranslations[lang] || errorTranslations['zh'];
  
  if (msgLower.includes('invalid login credentials')) {
    return dict.invalid_credentials;
  }
  if (msgLower.includes('email not confirmed')) {
    return dict.email_not_confirmed;
  }
  if (msgLower.includes('user not found')) {
    return dict.user_not_found;
  }
  if (msgLower.includes('user already exists') || msgLower.includes('already registered')) {
    return dict.user_already_exists;
  }
  if (msgLower.includes('rate limit exceeded') || msgLower.includes('too many requests')) {
    return dict.rate_limit_exceeded;
  }
  if (msgLower.includes('network request failed')) {
    return dict.network_failed;
  }
  if (msgLower.includes('password should be at least 6 characters')) {
    return dict.password_too_short;
  }
  if (msgLower.includes('signup requires email confirmation')) {
    return dict.signup_requires_confirmation;
  }
  if (msgLower.includes('invalid email') || msgLower.includes('email address is invalid')) {
    return dict.invalid_email;
  }
  if (msgLower.includes('credentials must be provided')) {
    return dict.credentials_required;
  }
  
  return message;
}

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
          is_banned: boolean;
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
          content: string;
          category: 'events' | 'academic' | 'life' | 'general';
          link: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string | null;
          token: string;
          updated_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['push_tokens']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['push_tokens']['Insert']>;
      };
    };
  };
};
