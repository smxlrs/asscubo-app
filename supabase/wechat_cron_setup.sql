-- ============================================================
-- 微信公众号文章定时拉取同步 - Supabase 数据库定时任务设置脚本
-- ============================================================
--
-- 【说明】：
-- 1. 请在您的 Supabase 网页后台 -> SQL Editor 中新建一个查询，并将以下 SQL 粘贴进去运行。
-- 2. 运行前，请务必将其中的两处占位符进行替换：
--    - <您的PROJECT_REF>：例如您的 Supabase 域名为 https://avxzgaozbfeqttmhmlld.supabase.co，
--                          则 PROJECT_REF 为 avxzgaozbfeqttmhmlld。
--    - <您的SERVICE_ROLE_KEY>：您在第一部分查到的 service_role 极长私钥。
--
-- ============================================================

-- 1. 确保启用所需的数据库扩展
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. 清理已经存在的同名定时任务（防止重复注册）
SELECT cron.unschedule('wechat-scheduled-sync');

-- 3. 注册定时任务：每 30 分钟自动请求一次 wechat-sync 边缘函数进行同步
--    如果您想修改时间间隔，例如：
--    - '0 * * * *'  ：每 1 小时整点触发一次
--    - '*/15 * * * *'：每 15 分钟触发一次
SELECT cron.schedule(
  'wechat-scheduled-sync',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<您的PROJECT_REF>.supabase.co/functions/v1/wechat-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <您的SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- 4. 查看当前所有已注册的定时任务列表（验证是否成功加入）
SELECT * FROM cron.job;
