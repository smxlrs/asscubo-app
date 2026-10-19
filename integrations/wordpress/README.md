# 博学网站文章来源

App 文章来源为 asscubo.it 的全部公开 WordPress 文章，部署与数据行为见 [DEPLOY.md](DEPLOY.md)。

`boxue-article-bridge` 为网站原采集插件保存的 `_wxsync_wx_url` 和 `_wxsync_article_key` 提供只读 REST 输出。已在网站启用；仅用于保存原始来源，不再作为文章导入条件，不必重新采集旧文章。

`audit-articles.cjs` 和配套测试是早期迁移核对工具，只读比较微信来源身份。其匹配清单不代表当前网站同步范围，不能用于筛选公开文章。

首页、查看全部页及文章页沿用原查询和分页；手动通知及其图片功能仍独立走 notifications 表。
