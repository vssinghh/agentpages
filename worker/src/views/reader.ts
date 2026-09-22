import { DocumentRecord } from '../types';

export function renderReaderView(doc: DocumentRecord, renderedHtml: string): string {
  const safeTitle = doc.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dateFormatted = new Date(doc.updated_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" id="hljs-theme">
  <style>
    :root {
      --bg: #ffffff;
      --text: #1f2937;
      --border: #e5e7eb;
      --card-bg: #f9fafb;
      --link: #2563eb;
      --code-bg: #f3f4f6;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0f172a;
        --text: #f1f5f9;
        --border: #334155;
        --card-bg: #1e293b;
        --link: #60a5fa;
        --code-bg: #1e293b;
      }
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.7;
      margin: 0;
      padding: 0;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding: 1rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      max-width: 860px;
      margin: 0 auto;
    }
    .header-meta {
      font-size: 0.875rem;
      opacity: 0.7;
    }
    .actions {
      display: flex;
      gap: 0.5rem;
    }
    .btn {
      background: var(--card-bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0.4rem 0.8rem;
      border-radius: 6px;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      transition: background 0.15s ease;
    }
    .btn:hover {
      opacity: 0.85;
    }
    .btn-primary {
      background: var(--link);
      color: #ffffff;
      border-color: var(--link);
    }
    main {
      max-width: 860px;
      margin: 2rem auto;
      padding: 0 1.5rem 4rem 1.5rem;
    }
    .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
      line-height: 1.3;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    .markdown-body h1 { font-size: 2.25rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    .markdown-body h2 { font-size: 1.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
    .markdown-body h3 { font-size: 1.25rem; }
    .markdown-body p, .markdown-body ul, .markdown-body ol {
      margin-bottom: 1.2em;
    }
    .markdown-body a {
      color: var(--link);
      text-decoration: underline;
    }
    .markdown-body code {
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.875em;
    }
    .markdown-body pre {
      background-color: var(--code-bg);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid var(--border);
    }
    .markdown-body pre code {
      background-color: transparent;
      padding: 0;
      font-size: 0.875rem;
    }
    .markdown-body blockquote {
      border-left: 4px solid var(--border);
      padding-left: 1rem;
      margin-left: 0;
      opacity: 0.8;
      font-style: italic;
    }
    .markdown-body table {
      border-collapse: collapse;
      width: 100%;
      margin: 1.5rem 0;
    }
    .markdown-body table th, .markdown-body table td {
      border: 1px solid var(--border);
      padding: 0.6rem 1rem;
      text-align: left;
    }
    .markdown-body table th {
      background-color: var(--card-bg);
    }
    footer {
      border-top: 1px solid var(--border);
      text-align: center;
      padding: 2rem 1rem;
      font-size: 0.875rem;
      opacity: 0.7;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <span class="header-meta">Updated ${dateFormatted} &bull; v${doc.version}</span>
    </div>
    <div class="actions">
      <button class="btn" id="copyBtn" onclick="copyRaw()">Copy Markdown</button>
      <a href="/p/${doc.id}/edit" class="btn btn-primary">Edit</a>
    </div>
  </header>
  <main>
    <article class="markdown-body">
      ${renderedHtml}
    </article>
  </main>
  <footer>
    Published with <a href="https://github.com" target="_blank" style="color: inherit; font-weight: 500;">agentpages</a>
  </footer>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      hljs.highlightAll();
      renderMathInElement(document.body, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ]
      });
    });

    function copyRaw() {
      fetch('/api/document/${doc.id}')
        .then(res => res.json())
        .then(data => {
          navigator.clipboard.writeText(data.markdown).then(() => {
            const btn = document.getElementById('copyBtn');
            const old = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = old; }, 2000);
          });
        });
    }
  </script>
</body>
</html>`;
}
