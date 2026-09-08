-- ============================================================
-- 微信公众号文章定时拉取同步 - Supabase 数据库定时任务设置脚本
-- ============================================================
--
-- 【说明】：
-- 1. 请在您的 Supabase 网页后台 -> SQL Editor 中新建一个查询，并将以下 SQL 粘贴进去运行。
-- 2. 凭据必须存放在 Supabase Vault，不要写进 SQL 文件或 cron.job.command。
-- 3. 现有项目直接执行 migrations/021_switch_cron_to_secret_keys.sql。
--
-- ============================================================

-- 1. 确保启用所需的数据库扩展
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 安全说明：不要再把 service_role key 直接写入此文件或 cron.job.command。
-- 现有项目请执行 migrations/021_switch_cron_to_secret_keys.sql，
-- 它会读取 Vault 中的新 secret key，并重新创建定时任务。

-- 3. 注册定时任务：每 30 分钟自动请求一次 wechat-sync 边缘函数进行同步
--    如果您想修改时间间隔，例如：
--    - '0 * * * *'  ：每 1 小时整点触发一次
--    - '*/15 * * * *'：每 15 分钟触发一次
-- 定时任务定义见 migrations/021_switch_cron_to_secret_keys.sql。

-- 4. 查看当前所有已注册的定时任务列表（验证是否成功加入）
SELECT * FROM cron.job;
