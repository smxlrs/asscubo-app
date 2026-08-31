export const ADMIN_PERMISSION_OPTIONS = [
  {
    key: 'feedback.manage',
    label: '用户反馈管理',
    description: '查看、回复、标记和删除用户反馈',
    icon: 'message-draw',
  },
  {
    key: 'articles.sync',
    label: '文章同步',
    description: '导入微信公众号文章并立即同步',
    icon: 'sync',
  },
  {
    key: 'articles.manage',
    label: '文章管理',
    description: '修改分类、置顶、下架和恢复文章',
    icon: 'playlist-edit',
  },
  {
    key: 'notifications.publish',
    label: '通知发布',
    description: '创建通知并向用户群发推送',
    icon: 'bullhorn-outline',
  },
  {
    key: 'notifications.manage',
    label: '通知管理',
    description: '修改分类、置顶和删除已有通知',
    icon: 'bell-ring-outline',
  },
  {
    key: 'events.manage',
    label: '活动发布与管理',
    description: '创建、编辑、发布活动并管理报名信息',
    icon: 'calendar-edit',
  },
  {
    key: 'handbook.manage',
    label: '新生手册管理',
    description: '新增、编辑、排序、发布和删除手册章节',
    icon: 'book-open-page-variant-outline',
  },
  {
    key: 'cssa_card.manage',
    label: '学联卡管理',
    description: '管理学联卡相关资料与功能',
    icon: 'card-account-details-outline',
  },
  {
    key: 'users.moderate',
    label: '用户内容与封禁管理',
    description: '处理违规头像、昵称及封禁状态',
    icon: 'account-cog-outline',
  },
  {
    key: 'users.delete',
    label: '永久删除用户',
    description: '永久删除普通用户账号，建议谨慎授予',
    icon: 'account-remove-outline',
    dangerous: true,
  },
] as const;

export type AdminPermission = typeof ADMIN_PERMISSION_OPTIONS[number]['key'];

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = ADMIN_PERMISSION_OPTIONS.map((item) => item.key);
