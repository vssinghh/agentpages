import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(markdown);
  return typeof html === 'string' ? html : '';
}
