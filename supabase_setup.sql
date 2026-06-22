-- ============================================================
-- 学生学联官方平台 - 推送通知与设备 Token 数据库设置脚本
-- 在 Supabase SQL Editor 中执行此脚本来完成数据库升级
-- ============================================================

-- 1. 重新创建 notifications 表
DROP TABLE IF EXISTS public.notifications CASCADE;

CREATE TABLE public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('events', 'academic', 'life', 'general')),
  link TEXT,
  cover_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 启用 RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 任何人（包括游客和登录用户）都可以查看通知历史
CREATE POLICY "Anyone can read notifications" ON public.notifications
  FOR SELECT TO anon, authenticated
  USING (true);

-- 只有管理员能发布和管理通知
CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));


-- 2. 创建 push_tokens 表（如果已存在则不创建）
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 启用 RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- 允许任何人（包括未登录用户注册 Token 时）插入或更新自己的设备 Token
CREATE POLICY "Allow anyone to register or update their own push token" ON public.push_tokens
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 只有管理员能查询所有设备 Token
CREATE POLICY "Admins can select all push tokens" ON public.push_tokens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));


-- 3. 升级用户注册触发器，自动将 auth.users 中的注册昵称（name）和角色同步到 public.profiles 表中
-- 这样在邮箱验证前，即使用户处于未登录状态且受 RLS 限制，数据库触发器也能安全地写入昵称
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

