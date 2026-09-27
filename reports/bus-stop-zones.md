# 公交站 Zona 数据更新

站点详情显示 `站牌号：1 · Zona 500`。Zona 来自 TPER 官方 fermate 的 codice_zona，表示票价区域编号，不是需购买的区域数量。0、缺失、无效或冲突的区域不显示。

打开站点、刷新详情时从 Supabase 精确读取站点信息。官方 fermate 版本变化也会触发站点同步，不依赖 GTFS 同时变化。沿用现有每周同步任务，不增加轮询频率。后续区域数据变化不需要重新打包 App；首次新增界面仍需使用包含此次改动的客户端。

## 上线步骤

1. 在 Supabase SQL Editor 执行 `supabase/migrations/045_bus_stop_zones.sql`。
2. 在已链接正确项目的仓库根目录执行：

```powershell
npx supabase functions deploy tper-stops-sync
```

3. 等待现有每周同步任务，或在 SQL Editor 执行下面的 SQL，立即调用现有任务一次（不创建新定时任务，也不输出密钥）：

```sql
DO $$
DECLARE task_command text;
BEGIN
  SELECT command INTO task_command FROM cron.job
  WHERE jobname = 'tper-stops-weekly-sync' AND active;
  IF task_command IS NULL THEN
    RAISE EXCEPTION '没有找到启用的 tper-stops-weekly-sync 任务，请检查原有站点同步配置';
  END IF;
  EXECUTE task_command;
END;
$$;
```

这是异步请求。稍后检查以下结果，确认 last_success_at 更新、stop_details_version 有值、last_error 为空：

```sql
SELECT last_success_at, stop_details_version, last_error FROM public.tper_stop_sync_state;
SELECT stop_code, stop_name, zone_code FROM public.bus_stops WHERE stop_code = '1';
```

未完成首次同步前不显示 Zona。部署函数本身不会自动立即执行同步。

## 验证

- 客户端 `npx tsc --noEmit` 通过。
- `supabase/tests/bus-stop-zones.mjs`：本地 5,000 站点同步、区域变化和清空、非法载荷回滚、权限限制、迁移重复执行，以及真实 Edge handler 的初次补全、仅区域版本变化、版本不变跳过场景通过。
- 未向生产数据库写入测试数据，未代为部署；尚未进行手机视觉验收。
