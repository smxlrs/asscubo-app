-- ============================================================
-- 学生学联官方平台 - 微信文章与通知测试数据导入脚本
-- 在 Supabase SQL Editor 中运行此脚本来导入测试数据
-- ============================================================

-- 1. 插入微信测试文章到 articles 表
INSERT INTO public.articles (
  id,
  title,
  content,
  summary,
  category,
  cover_image,
  is_published,
  view_count,
  created_at,
  updated_at
) VALUES 
(
  'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1',
  '博大新生注册与税号办理全攻略',
  '微信推文详情页，请直接查看外链',
  '为方便2026学年博大新生顺利入学，学联特整理此攻略，涵盖税号（Codice Fiscale）、居留、医疗卡办理及入学注册步骤。',
  'notice',
  'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=600&auto=format&fit=crop',
  true,
  145,
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '1 hour'
),
(
  'a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2',
  '博洛尼亚吃喝玩乐与生活省钱指南',
  '微信推文详情页，请直接查看外链',
  '在博洛尼亚留学，如何吃得好又省钱？本文为您推荐本地高性价比超市、留学生特惠餐厅及常用生活小贴士。',
  'news',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop',
  true,
  98,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),
(
  'a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3',
  '学联招新 | 期待与你共同开启新篇章！',
  '微信推文详情页，请直接查看外链',
  '无论你是擅长活动策划、文案宣发、技术支持还是外联公关，学联的大门都为你敞开！快来加入我们吧！',
  'event_news',
  'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=600&auto=format&fit=crop',
  true,
  230,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
);

-- 2. 插入测试通知到 notifications 表
INSERT INTO public.notifications (
  id,
  title,
  content,
  category,
  link,
  created_at
) VALUES 
(
  'n1n1n1n1-n1n1-n1n1-n1n1-n1n1n1n1n1n1',
  '博大新生注册与税号办理全攻略',
  '为方便2026学年博大新生顺利入学，学联特整理此攻略，涵盖税号（Codice Fiscale）、居留、医疗卡办理及入学注册步骤。',
  'academic',
  'https://mp.weixin.qq.com/s/7qZzNq2686Y_Example1',
  NOW() - INTERVAL '1 hour'
),
(
  'n2n2n2n2-n2n2-n2n2-n2n2-n2n2n2n2n2n2',
  '博洛尼亚吃喝玩乐与生活省钱指南',
  '在博洛尼亚留学，如何吃得好又省钱？本文为您推荐本地高性价比超市、留学生特惠餐厅及常用生活小贴士。',
  'life',
  'https://mp.weixin.qq.com/s/7qZzNq2686Y_Example2',
  NOW() - INTERVAL '1 day'
),
(
  'n3n3n3n3-n3n3-n3n3-n3n3-n3n3n3n3n3n3',
  '学联招新 | 期待与你共同开启新篇章！',
  '无论你是擅长活动策划、文案宣发、技术支持还是外联公关，学联的大门都为你敞开！快来加入我们吧！',
  'events',
  'https://mp.weixin.qq.com/s/7qZzNq2686Y_Example3',
  NOW() - INTERVAL '3 days'
);
