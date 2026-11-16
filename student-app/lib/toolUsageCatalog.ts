export const TOOL_USAGE_TOOLS = [
  { id: 'bus', label: '公交' }, { id: 'train', label: '火车' },
  { id: 'dictionary', label: '词典' }, { id: 'rate', label: '汇率' },
  { id: 'classroom', label: '教室' }, { id: 'studyroom', label: '自习室' },
  { id: 'handbook', label: '新生手册' }, { id: 'events', label: '活动' },
] as const;
export type UsageTool = typeof TOOL_USAGE_TOOLS[number]['id'];

export function usageToolForPath(path: string): UsageTool | null {
  const normalized = path.split('?')[0].replace(/\/+$/, '');
  if (normalized === '/tools/rate-settings') return 'rate';
  for (const { id } of TOOL_USAGE_TOOLS) {
    if (normalized === `/tools/${id}` || normalized.startsWith(`/tools/${id}/`)) return id;
  }
  return null;
}
export const usageToolLabel = (id: string) => TOOL_USAGE_TOOLS.find(tool => tool.id === id)?.label || id;
export function usageDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
  return `${Math.floor(seconds / 3600)} 小时 ${Math.floor(seconds % 3600 / 60)} 分`;
}
