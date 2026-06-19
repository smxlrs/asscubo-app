-- ============================================================
-- 学生学联官方平台 - 用户提供微信推文测试数据导入脚本
-- 在 Supabase SQL Editor 中运行此脚本来导入这三篇微信推文
-- ============================================================

-- 1. 插入实际微信文章到 articles 表
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
  'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1',
  '原创专栏|博洛尼亚 IL Cinema Ritrovato探佚电影节',
  '微信推文详情页，请直接查看外链',
  '探佚电影节（IL Cinema Ritrovato）作为全球影迷和电影学者的年度盛事在博洛尼亚开启。学联特此为您整理观影亮点与出行指南！',
  'general',
  'https://mmbiz.qpic.cn/sz_mmbiz_jpg/2UvUwLMxhsjY0nxfIk8SuI6O7Swic4u24AHXFpXYX9F9Mz69SGBYbc3CibVarypwAZkhlEtOEuFgOWQPzXpJsf6DYvsxHSVSNzomficZ7q0Iia0/0?wx_fmt=jpeg',
  true,
  241,
  NOW() - INTERVAL '10 minutes',
  NOW() - INTERVAL '10 minutes'
),
(
  'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2',
  '新生福利！学联官方新生手册与群二维码公开',
  '微信推文详情页，请直接查看外链',
  '为方便广大留学生交流与新生入学，博洛尼亚中国学生学者联谊会已发布最新群二维码及核心办理手册，点击查看详情。',
  'notice',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop',
  true,
  312,
  NOW() - INTERVAL '30 minutes',
  NOW() - INTERVAL '30 minutes'
),
(
  'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
  '请查收 《2026版防范电信网络诈骗宣传手册》（全文）',
  '微信推文详情页，请直接查看外链',
  '针对近期频发的留学电信诈骗案，特此转发《2026版防范电信网络诈骗宣传手册》全文，涵盖最新常见骗局拆解与防范指引。',
  'notice',
  'https://mmbiz.qpic.cn/mmbiz_jpg/2UvUwLMxhshzFGttnSquRZevjDLJlibnnMYicDIsBPn8icM6dEQ3JWYXlAkqdmEOpdoxMp9l14Xbnsv7qcqvxDkG2ZDkZKHmicI9d2dJhfTrvJE/0?wx_fmt=jpeg',
  true,
  89,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
);

-- 2. 插入实际测试通知到 notifications 表
INSERT INTO public.notifications (
  id,
  title,
  content,
  category,
  link,
  cover_image,
  created_at
) VALUES 
(
  'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
  '原创专栏|博洛尼亚 IL Cinema Ritrovato探佚电影节',
  '探佚电影节（IL Cinema Ritrovato）作为全球影迷 and 电影学者的年度盛事在博洛尼亚开启。学联特此为您整理观影亮点与出行指南！',
  'general',
  'https://mp.weixin.qq.com/s/wDF28-8PCcTVYtPDKOQhng',
  'https://mmbiz.qpic.cn/sz_mmbiz_jpg/2UvUwLMxhsjY0nxfIk8SuI6O7Swic4u24AHXFpXYX9F9Mz69SGBYbc3CibVarypwAZkhlEtOEuFgOWQPzXpJsf6DYvsxHSVSNzomficZ7q0Iia0/0?wx_fmt=jpeg',
  NOW() - INTERVAL '10 minutes'
),
(
  'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
  '新生福利！学联官方新生手册与群二维码公开',
  '为方便广大留学生交流与新生入学，博洛尼亚中国学生学者联谊会已发布最新群二维码及核心办理手册，点击查看详情。',
  'events',
  'http://mp.weixin.qq.com/s?__biz=Mzg4Nzg3MDQyOQ==&mid=2247496892&idx=1&sn=124f670129f4ee920a12e2121e37c2f5&chksm=cef8858f827a1754ad58d4a3d4efabff39d82d0ff85979165750ab7b3b6bfe396af03274bfdc&scene=126&sessionid=1781823275&subscene=91&clicktime=1781823301&enterid=1781823301#rd',
  'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=600&auto=format&fit=crop',
  NOW() - INTERVAL '30 minutes'
),
(
  'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3',
  '请查收 《2026版防范电信网络诈骗宣传手册》（全文）',
  '针对近期频发的留学电信诈骗案，特此转发《2026版防范电信网络诈骗宣传手册》全文，涵盖最新常见骗局拆解与防范指引。',
  'academic',
  'http://mp.weixin.qq.com/s?__biz=Mzg4Nzg3MDQyOQ==&mid=2247496922&idx=1&sn=be9b40823ef66569b96fe953a525cf63&chksm=cee8633ae52807aa012d851eb67aca46acf0edd5e9a0ce12e5cb21e2cd722f078297d0e618c4&scene=126&sessionid=1781823275&subscene=91&clicktime=1781823310&enterid=1781823310#rd',
  'https://mmbiz.qpic.cn/mmbiz_jpg/2UvUwLMxhshzFGttnSquRZevjDLJlibnnMYicDIsBPn8icM6dEQ3JWYXlAkqdmEOpdoxMp9l14Xbnsv7qcqvxDkG2ZDkZKHmicI9d2dJhfTrvJE/0?wx_fmt=jpeg',
  NOW() - INTERVAL '2 hours'
);
