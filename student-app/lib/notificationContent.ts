function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderBody(value: string): string {
  // The editor accepts plain text plus uploaded image tags. Escape typed text
  // while retaining HTTPS images, without copying arbitrary HTML attributes.
  const imagePattern = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi;
  let html = '';
  let cursor = 0;
  for (const match of value.matchAll(imagePattern)) {
    html += escapeHtml(value.slice(cursor, match.index));
    const url = match[2].replace(/&amp;/g, '&');
    if (/^https:\/\/[^\s<>]+$/i.test(url)) {
      html += `<img src="${escapeHtml(url)}" style="max-width:100%;height:auto;display:block;border-radius:8px;margin:10px 0;" />`;
    }
    cursor = match.index! + match[0].length;
  }
  return html + escapeHtml(value.slice(cursor));
}

export function buildNotificationContent(summary: string, body: string): string {
  // Keep existing summary-only notifications compatible without a schema change.
  if (!body.trim()) return summary.trim();
  return `<p data-notification-summary="true">${escapeHtml(summary.trim())}</p>\n<div style="white-space:pre-wrap;">${renderBody(body.trim())}</div>`;
}

export function notificationPreview(content: string | null | undefined): string | null {
  if (!content) return null;
  const summary = content.match(/<p data-notification-summary="true">([\s\S]*?)<\/p>/);
  if (!summary) {
    // Older notifications store their brief as plain text.
    return content.replace(/<[^>]*>/g, '').trim() || null;
  }
  return summary[1].replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
