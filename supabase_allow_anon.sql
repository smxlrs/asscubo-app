-- ============================================================
-- SQL SCRIPT: 允许未登录用户浏览 & 修复管理员发布通知失败 & 意见反馈做真 & 敏感词防御
-- 请在您的 Supabase 网页后台 -> SQL Editor 中新建一个查询，粘贴此 SQL 并运行
-- ============================================================

-- 1. 允许任何人（包括未登录用户）查看已发布的文章
DROP POLICY IF EXISTS "Published articles viewable by all" ON public.articles;
CREATE POLICY "Published articles viewable by all" ON public.articles
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- 2. 允许任何人（包括未登录用户）查看通知
DROP POLICY IF EXISTS "Authenticated users can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can read notifications" ON public.notifications;
CREATE POLICY "Anyone can read notifications" ON public.notifications
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. 允许任何人（包括未登录用户）查看已发布的活动
DROP POLICY IF EXISTS "Published events viewable by all" ON public.events;
CREATE POLICY "Published events viewable by all" ON public.events
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- 4. 允许任何人（包括未登录用户）查看电子学生手册已发布的章节
DROP POLICY IF EXISTS "Published handbook visible to all" ON public.handbook_chapters;
CREATE POLICY "Published handbook visible to all" ON public.handbook_chapters
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

-- 5. 清理 notifications 表上残留的可能导致向 articles 表错误插入的触发器 (Trigger)
-- 解决报错: null value in column "content" of relation "articles" violates not-null constraint
DO $$
DECLARE
    trig RECORD;
BEGIN
    FOR trig IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'notifications'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(trig.trigger_name) || ' ON public.notifications;';
        RAISE NOTICE 'Dropped trigger: %', trig.trigger_name;
    END LOOP;
END $$;

-- 6. 创建意见反馈表 feedbacks 并配置 RLS 策略 (使反馈功能做真)
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email TEXT NOT NULL,
  wechat TEXT,
  content TEXT NOT NULL,
  media_url TEXT,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- 允许任何人（包括游客和登录用户）提交反馈
DROP POLICY IF EXISTS "Allow anyone to insert feedback" ON public.feedbacks;
CREATE POLICY "Allow anyone to insert feedback" ON public.feedbacks
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 仅允许管理员查看反馈
DROP POLICY IF EXISTS "Only admins can view feedback" ON public.feedbacks;
CREATE POLICY "Only admins can view feedback" ON public.feedbacks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 仅允许管理员更新反馈状态
DROP POLICY IF EXISTS "Only admins can update feedback" ON public.feedbacks;
CREATE POLICY "Only admins can update feedback" ON public.feedbacks
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));

-- 7. 允许未登录用户上传反馈图片/视频到 covers 存储桶
DROP POLICY IF EXISTS "Allow anon upload to covers" ON storage.objects;
CREATE POLICY "Allow anon upload to covers" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'covers');

-- 8. 修复并更新 profiles 昵称敏感词校验触发器 (具有智能防御性逻辑，避免空值和短 ASCII 词误杀)
CREATE OR REPLACE FUNCTION public.check_sensitive_nickname()
RETURNS TRIGGER AS $$
DECLARE
  normalized_name TEXT;
  word_match RECORD;
  normalized_word TEXT;
BEGIN
  -- Only validate name when it is set and has changed
  IF NEW.name IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.name IS DISTINCT FROM OLD.name) THEN
    -- Normalize the new nickname
    normalized_name := public.normalize_nickname(NEW.name);
    
    -- Check against the normalized sensitive words
    FOR word_match IN SELECT word FROM public.sensitive_words LOOP
      normalized_word := public.normalize_nickname(word_match.word);
      -- 防御性逻辑 1：只在敏感词归一化后非空时才进行匹配，防止空匹配导致误杀所有昵称
      IF normalized_word <> '' THEN
        -- 防御性逻辑 2：如果是纯英文/数字（ASCII字符）且长度小于等于 3，则必须精确匹配，避免子串误杀（如 an, it, 23）
        IF normalized_word ~ '^[a-z0-9]+$' AND length(normalized_word) <= 3 THEN
          IF normalized_name = normalized_word THEN
            RAISE EXCEPTION '昵称包含敏感词汇 "%"，请更换其它昵称。', word_match.word;
          END IF;
        ELSE
          -- 其它情况（包含中文，或英文数字长度大于 3），允许子串模糊匹配
          IF normalized_name LIKE '%' || normalized_word || '%' THEN
            RAISE EXCEPTION '昵称包含敏感词汇 "%"，请更换其它昵称。', word_match.word;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
