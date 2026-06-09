-- ============================================================
-- 学生学联官方平台 - 数据库初始化脚本
-- 在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 用户资料表（扩展 Supabase Auth 的 auth.users）
-- ============================================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  student_id TEXT UNIQUE,
  name TEXT,
  faculty TEXT,          -- 院系
  major TEXT,            -- 专业
  campus TEXT,           -- 校区
  enrollment_year INTEGER, -- 入学年份
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'super_admin')),
  avatar_url TEXT,
  push_token TEXT,       -- Expo 推送 token
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 文章/公告表
-- ============================================================
CREATE TABLE public.articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('notice', 'news', 'event_news', 'general')),
  cover_image TEXT,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- 活动表
-- ============================================================
CREATE TABLE public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  max_participants INTEGER,
  cover_image TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  registration_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 活动报名表
CREATE TABLE public.event_registrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  registered_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlist')),
  UNIQUE(event_id, user_id)
);

-- ============================================================
-- 电子学生手册
-- ============================================================
CREATE TABLE public.handbook_chapters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT 'richtext' CHECK (content_type IN ('pdf', 'richtext')),
  content_url TEXT,      -- PDF 文件 URL
  content_body TEXT,     -- 富文本内容 (Markdown)
  parent_id UUID REFERENCES public.handbook_chapters(id) ON DELETE CASCADE,
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- 社群/留言板
-- ============================================================
CREATE TABLE public.community_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_type TEXT NOT NULL CHECK (group_type IN ('faculty', 'year', 'campus', 'general')),
  group_value TEXT NOT NULL DEFAULT 'all', -- 具体的院系/年份/校区名
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  reply_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 帖子回复
CREATE TABLE public.post_replies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 自动更新回复数
CREATE OR REPLACE FUNCTION public.update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts SET reply_count = reply_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_reply_change
  AFTER INSERT OR DELETE ON public.post_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_reply_count();

-- ============================================================
-- 推送通知记录
-- ============================================================
CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT DEFAULT 'all' CHECK (target_type IN ('all', 'faculty', 'year', 'campus')),
  target_value TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  sent_count INTEGER DEFAULT 0
);

-- ============================================================
-- Row Level Security (RLS) 策略
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handbook_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: 用户查看所有，只能更新自己
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Articles: 已发布的所有人可看，管理员可增删改
CREATE POLICY "Published articles viewable by all" ON public.articles FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Admins can manage articles" ON public.articles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Events: 已发布的所有人可看
CREATE POLICY "Published events viewable by all" ON public.events FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Event registrations: 用户管理自己的报名
CREATE POLICY "Users can view own registrations" ON public.event_registrations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can register" ON public.event_registrations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can cancel own registration" ON public.event_registrations FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all registrations" ON public.event_registrations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Handbook: 已发布章节所有人可看
CREATE POLICY "Published handbook visible to all" ON public.handbook_chapters FOR SELECT TO authenticated USING (is_published = true);
CREATE POLICY "Admins can manage handbook" ON public.handbook_chapters FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Community posts: 认证用户可读写
CREATE POLICY "Authenticated users can read posts" ON public.community_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create posts" ON public.community_posts FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can update own posts" ON public.community_posts FOR UPDATE TO authenticated USING (author_id = auth.uid());
CREATE POLICY "Admins or author can delete posts" ON public.community_posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- Post replies
CREATE POLICY "Authenticated users can read replies" ON public.post_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create replies" ON public.post_replies FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "Author can delete own reply" ON public.post_replies FOR DELETE TO authenticated USING (author_id = auth.uid());

-- Notifications: 只读
CREATE POLICY "Authenticated users can read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- ============================================================
-- 插入示例数据
-- ============================================================

-- 注意：先在 Supabase Auth 创建管理员账号后，将其 UUID 替换下方的 YOUR_ADMIN_USER_UUID
-- UPDATE public.profiles SET role = 'super_admin' WHERE id = 'YOUR_ADMIN_USER_UUID';
