import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function sanitizeHtml(html: string): string {
  // Strip dangerous tags and their contents
  let clean = html.replace(/<(script|style|iframe|object|embed|form|input|button)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  clean = clean.replace(/<(script|style|iframe|object|embed|form|input|button)\b[^>]*\/?>/gi, '');

  // Strip inline JavaScript event handlers (e.g. onerror, onclick)
  clean = clean.replace(/\s+on[a-z]+=(["'][^"']*["']|[^\s>]+)/gi, '');

  // Neutralize pseudo-protocol URLs
  clean = clean.replace(/(href|src)=(["'])\s*(javascript|vbscript|data):/gi, '$1=$2#blocked:');

  return clean;
}

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown);
  const rawHtml = typeof html === 'string' ? html : '';
  return sanitizeHtml(rawHtml);
}
