# AG Features Map (功能与文件结构映射表)

本文档将应用程序的各个功能模块与其在代码库中的具体文件/目录进行映射。这样可以帮助我们在开发和修改特定功能时，**精准读取相关文件的上下文**，从而避免一次性读取过多无关文件，节省 Token 额度。

---

## 1. 意铁看板与车次追踪 (Italian Train Info Query Tool)
- **服务层 (API 请求、运营商映射、历史与收藏逻辑):**
  - [viaggiaTrenoService.ts](file:///i:/PARTTIME/AG/student-app/lib/viaggiaTrenoService.ts) — 处理 Trenitalia/Trenord/Italo/Tper 等 API 的数据请求及数据补全
- **UI 页面与交互 (React Native / Expo Router):**
  - [index.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/train/index.tsx) — 车次与车站搜索主页、收藏/历史列表展示
  - [station-board.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/train/station-board.tsx) — 车站实时看板（出发/到达、站台、运营商徽章及收藏）
  - [train-status.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/train/train-status.tsx) — 车次实时追踪纵向时间线、晚点信息与收藏
- **模糊搜索数据源:**
  - [stations.ts](file:///i:/PARTTIME/AG/student-app/assets/stations.ts) — 车站拼音/意大利文模糊搜索索引

---

## 2. 教室查询与空闲教室筛选 (Classroom Query Tool)
- **UI 页面与交互:**
  - [classroom/index.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/classroom/index.tsx) — 包含教学楼筛选、容量筛选、校区筛选（博洛尼亚/拉文纳等）以及防止查词重置滚动位置的防抖重置逻辑
- **数据库读取 (Supabase/本地缓存):**
  - [db.ts](file:///i:/PARTTIME/AG/student-app/lib/db.ts) — 本地 SQLite 缓存与查询逻辑

---

## 3. 多词库离线字典查询 (Dictionary Search Tool)
- **UI 页面与交互:**
  - [dictionary/index.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/dictionary/index.tsx) — 字典主界面，优化了查词后不再自动滚动回顶部的体验
  - [dictionary/settings.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/dictionary/settings.tsx) — 词库选择与字典设置页面
- **MDict 词典解析引擎:**
  - [mdictReader.ts](file:///i:/PARTTIME/AG/student-app/lib/mdict/mdictReader.ts) — MDict (.mdx/.mdd) 词典解析核心代码
  - [utils.ts](file:///i:/PARTTIME/AG/student-app/lib/mdict/utils.ts) — 压缩/数据转换辅助工具

---

## 4. 学生手册检索系统 (Student Handbook Tool)
- **UI 页面与交互:**
  - [handbook/index.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/handbook/index.tsx) — 学生手册关键字检索、章节展示页面
- **数据库存储:**
  - [db.ts](file:///i:/PARTTIME/AG/student-app/lib/db.ts) — 本地 SQLite 数据库查询，包含手册条目表结构及全文检索

---

## 5. 实时汇率换算工具 (Exchange Rate Tool)
- **UI 页面与交互:**
  - [rate.tsx](file:///i:/PARTTIME/AG/student-app/app/tools/rate.tsx) — 常见货币实时汇率计算与转换

---

## 6. 全局公共模块 (Shared Modules)
- **主题与多语言国际化 Context:**
  - [ThemeContext.tsx](file:///i:/PARTTIME/AG/student-app/context/ThemeContext.tsx) — 全局亮暗色主题、中/意/英语言切换逻辑
- **网络与 Supabase 客户端:**
  - [supabase.ts](file:///i:/PARTTIME/AG/student-app/lib/supabase.ts) — Supabase 初始化与通用客户端
