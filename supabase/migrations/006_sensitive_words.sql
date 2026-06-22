-- 1. Create sensitive words table
CREATE TABLE IF NOT EXISTS public.sensitive_words (
  word TEXT PRIMARY KEY
);

-- Enable RLS for sensitive_words table
ALTER TABLE public.sensitive_words ENABLE ROW LEVEL SECURITY;

-- Allow public read of sensitive words
CREATE POLICY "Allow public select of sensitive_words" ON public.sensitive_words
  FOR SELECT TO public
  USING (true);

-- 2. Insert robust seed of sensitive words (political figures, organizations, events, movements, and memes)
INSERT INTO public.sensitive_words (word) VALUES
  ('习近平'), ('xjp'), ('xijinping'),
  ('江泽民'), ('jzm'),
  ('胡锦涛'), ('hjt'),
  ('温家宝'), ('wjb'),
  ('毛泽东'), ('mzd'),
  ('邓小平'), ('dxp'),
  ('天安门事件'), ('tiananmensquare'),
  ('六四'), ('8964'), ('6420'), ('5月35日'),
  ('共产党'), ('ccp'), ('gongchandang'),
  ('共青团'), ('共产主义'),
  ('国务院'), ('中纪委'), ('国安局'),
  ('法轮功'), ('flg'), ('falungong'), ('李洪志'),
  ('达赖喇嘛'), ('dalailama'),
  ('台独'), ('taidu'),
  ('港独'), ('gangdu'),
  ('藏独'), ('zangdu'),
  ('疆独'), ('jiangdu'),
  ('反共'), ('fangong'),
  ('民运'), ('minyun'),
  ('墙国'), ('qiangguo'),
  ('维尼'), ('weini'),
  ('天朝'), ('tianchao'),
  ('割韭菜'), ('gejiucai'),
  ('赵家人'), ('zhaojiaren')
ON CONFLICT (word) DO NOTHING;

-- 3. Create helper function for normalizing Chinese text (stripping special chars, lowercase, traditional to simplified)
CREATE OR REPLACE FUNCTION public.normalize_nickname(input_text TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  -- a. Lowercase the text
  normalized := LOWER(input_text);
  
  -- b. Strip common punctuation, spaces, and special symbols
  normalized := regexp_replace(normalized, '[\s\.\_\*\-\/\\\|\|\~\!\@\#\$\%\^\&\(\)\+\=\?\,\:\;\[\]\{\}\<\>\"''，。、；：？！…—～（）《》〔〕【】『』「」“”‘’]+', '', 'g');
  
  -- c. Translate Traditional Chinese characters to Simplified Chinese
  normalized := translate(normalized, 
    '習澤濤寶東門獨賴雙協產黨國華義評紀專總書記墻維輪', 
    '习泽涛宝东门独赖双协产党国华义评纪专总书记墙维轮'
  );
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Create check trigger function to validate profile nicknames using normalization (with defensive logic)
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

-- 5. Create trigger on public.profiles table
DROP TRIGGER IF EXISTS before_profile_update_nickname ON public.profiles;
CREATE TRIGGER before_profile_update_nickname
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_sensitive_nickname();

-- 6. Create secure function to fetch registered users list with emails (Admin only)
CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS TABLE (
  id UUID,
  name TEXT,
  avatar_url TEXT,
  email TEXT,
  role TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  -- Only allow authenticated admin or super_admin users to access
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
  ) THEN
    RETURN QUERY
    SELECT 
      p.id,
      p.name,
      p.avatar_url,
      u.email::TEXT,
      p.role,
      p.push_token,
      p.created_at
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id
    ORDER BY p.created_at DESC;
  ELSE
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
