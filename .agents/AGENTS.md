# Workspace Customization Rules

- **Articles vs. Notifications Separation**:
  - The "Articles" tab screen in the code is [notifications.tsx](file:///i:/PARTTIME/AG/student-app/app/(tabs)/notifications.tsx) (translated to Chinese as "文章"). It fetches WeChat articles exclusively from the `articles` table in Supabase.
  - The "News & Notifications" feed is [announcements.tsx](file:///i:/PARTTIME/AG/student-app/app/(tabs)/announcements.tsx) (translated to Chinese as "动态与通知"). It displays both articles and notifications.
  - In the Admin panel, "管理已有文章及分类" ([manage-articles.tsx](file:///i:/PARTTIME/AG/student-app/app/admin/manage-articles.tsx)) acts on the `articles` table, and "管理已有通知及分类" ([manage-notifications.tsx](file:///i:/PARTTIME/AG/student-app/app/admin/manage-notifications.tsx)) acts on the `notifications` table.
  - These two concepts (Articles/文章 and Notifications/通知) must remain completely decoupled. Modifying or deleting notifications must never alter the `articles` table or affect the Articles tab.

- **Auto-Version Upgrade on Push**:
  - Whenever the user requests to push code, build, or deploy (e.g., "push", "eas build", "提交", "发布", "打包", etc.), the agent must **automatically increment the version number** in both [package.json](file:///i:/PARTTIME/AG/student-app/package.json) and [app.json](file:///i:/PARTTIME/AG/student-app/app.json) (specifically, incrementing the patch/last segment of the version string, e.g., `1.0.0.4` -> `1.0.0.5`) before executing the push/build commands.
  - This update must be done silently and automatically, without waiting for or asking the user for confirmation.
