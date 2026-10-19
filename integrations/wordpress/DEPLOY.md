# 网站文章来源同步

App 的 articles 表以 https://asscubo.it 的全部公开、无密码 WordPress 文章为来源。不再要求微信来源元数据，不读取 WordPress 页面或草稿。notifications 表独立保留，完全不参与此次同步。

## 同步行为

- 每页读取 100 篇直到读完；校验总数、页数、唯一 ID。网络失败或分页不完整时不切换展示集合。每次网站请求超时 20 秒。
- WordPress ID 定义文章身份，同名文章或相同微信来源不会误合并。已有映射记录保留 UUID、人工分类、置顶和阅读数；标题、摘要、封面、阅读链接、发布时间跟随网站。
- 新记录分批暂存为隐藏，完整成功后通过事务发布当前网站集合；旧微信记录和网站已移除的记录只隐藏，不删除。
- 历史回填不推送。只有既有迁移截止时间后发布且首次导入的文章进入原推送流程。
- 首页仍取 5 篇文章，与通知按原逻辑展示；首页“查看全部”保留原查询限制；文章页仍每批 15 篇继续加载。前端无改动，已安装 App 刷新即可使用。
- 原后台按钮文字可能仍叫“微信文章同步”，入口实际同步网站。原定时任务每 30 分钟调用相同入口，不需要新定时任务。

## 部署

1. 执行 migrations/046_wordpress_article_source.sql，再执行 047_wordpress_only_articles.sql。046 的推送截止时间不可重置。
2. 确保 ARTICLE_SOURCE=wordpress（未配置时默认 wordpress）。
3. 运行 `supabase functions deploy wechat-sync --project-ref avxzgaozbfeqttmhmlld --use-api --no-verify-jwt`。虽然关闭网关 JWT 校验，函数仍校验内部调用身份或具备 articles.sync 权限的管理员；匿名请求返回 401。
4. 以已授权身份 POST `{ "preview": true }` 检查 would_insert、would_update、would_archive，再实际同步。
5. 验证公开集合全部是网站链接、网站总数一致、重复同步无新增、通知表摘要未变。

切换 RPC 仅 service_role 可执行，匿名及普通登录用户无执行权限。部署后原定时任务可能立即运行，迁移必须先执行。

## 验证

`node --test integrations/wordpress/wordpress-sync.test.cjs integrations/wordpress/audit-articles.test.cjs`

覆盖无微信元数据文章、234 篇完整分页、重复标题、不完整响应保护、暂存失败保护、并发编辑保护、保留人工字段、重复同步、历史推送边界、鉴权、同步锁与权限约束。

迁移前后快照和执行报告保存在被 Git 忽略的 `.tmp/wordpress-migration/`，不含项目密钥。旧微信抓取代码保留供人工回退使用；切回微信不会自动恢复旧记录的发布状态，恢复展示需要按快照单独处理。

## 2026-10-19 线上结果

- 网站公开文章 234 篇，App 公开文章 234 篇，链接全部为 asscubo.it。
- 旧记录全部保留；54 条不属于当前网站集合的记录隐藏。总记录 288 条。
- 按 App 每批 15 篇的公开接口读取至末页，累计 234 篇，无重复 ID；首页 5 篇及查看全部 20 篇查询通过。
- 重复实际同步：新增 0、更新 0、跳过 234、推送批次 0。
- 原有记录分类、置顶、阅读数及来源标识保持，通知表记录数与内容摘要不变。
- 匿名同步入口及匿名切换 RPC 均返回 401。
- 13 项回归测试及共享模块类型检查通过；未进行真实手机 WebView 端到端测试。
