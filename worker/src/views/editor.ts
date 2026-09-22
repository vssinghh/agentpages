import { DocumentRecord } from '../types';

export function renderEditorView(doc: DocumentRecord): string {
  const safeTitle = doc.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapedMarkdown = JSON.stringify(doc.markdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Editing: ${safeTitle}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
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
    * { box-sizing: border-box; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--card-bg);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .title {
      font-weight: 600;
      font-size: 1rem;
    }
    .auth-input {
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.4rem 0.6rem;
      font-size: 0.85rem;
      background: var(--bg);
      color: var(--text);
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
    }
    .btn-primary {
      background: var(--link);
      color: #ffffff;
      border-color: var(--link);
    }
    .btn-primary:hover { opacity: 0.9; }
    .editor-container {
      display: flex;
      flex: 1;
      height: calc(100vh - 60px);
      overflow: hidden;
    }
    .pane {
      flex: 1;
      height: 100%;
      overflow-y: auto;
      padding: 1.5rem;
    }
    #editor {
      width: 100%;
      height: 100%;
      border: none;
      resize: none;
      outline: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.95rem;
      line-height: 1.6;
      background: var(--bg);
      color: var(--text);
    }
    .preview-pane {
      border-left: 1px solid var(--border);
      background: var(--bg);
    }
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      padding: 0.75rem 1.25rem;
      border-radius: 6px;
      color: #fff;
      font-size: 0.875rem;
      display: none;
      z-index: 100;
    }
    .toast-success { background: #16a34a; }
    .toast-error { background: #dc2626; }
  </style>
</head>
<body>
  <header>
    <div class="header-left">
      <a href="/p/${doc.id}" class="btn">&larr; View</a>
      <span class="title">Editing: ${safeTitle}</span>
    </div>
    <div style="display: flex; gap: 0.5rem; align-items: center;">
      <input type="password" id="editKeyInput" class="auth-input" placeholder="Edit Key or Secret" />
      <button class="btn btn-primary" id="saveBtn" onclick="saveDocument()">Save Changes</button>
    </div>
  </header>
  <div class="editor-container">
    <div class="pane">
      <textarea id="editor" spellcheck="false"></textarea>
    </div>
    <div class="pane preview-pane markdown-body" id="preview"></div>
  </div>
  <div id="toast" class="toast"></div>

  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    const initialContent = ${escapedMarkdown};
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const editKeyInput = document.getElementById('editKeyInput');
    const toast = document.getElementById('toast');

    editor.value = initialContent;

    const urlParams = new URLSearchParams(window.location.search);
    const keyFromUrl = urlParams.get('key') || urlParams.get('edit');
    if (keyFromUrl) {
      editKeyInput.value = keyFromUrl;
      localStorage.setItem('agent_md_edit_key_${doc.id}', keyFromUrl);
    } else {
      const stored = localStorage.getItem('agent_md_edit_key_${doc.id}') || localStorage.getItem('agent_md_admin_secret');
      if (stored) editKeyInput.value = stored;
    }

    function updatePreview() {
      preview.innerHTML = marked.parse(editor.value, { gfm: true, breaks: true });
      preview.querySelectorAll('pre code').forEach((el) => {
        hljs.highlightElement(el);
      });
      renderMathInElement(preview, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false}
        ]
      });
    }

    editor.addEventListener('input', updatePreview);
    updatePreview();

    function showToast(msg, isError = false) {
      toast.textContent = msg;
      toast.className = 'toast ' + (isError ? 'toast-error' : 'toast-success');
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 3000);
    }

    async function saveDocument() {
      const key = editKeyInput.value.trim();
      if (!key) {
        showToast('Please enter the Edit Key or Admin Secret to save.', true);
        editKeyInput.focus();
        return;
      }
      localStorage.setItem('agent_md_edit_key_${doc.id}', key);

      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const res = await fetch('/api/document/${doc.id}', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Edit-Key': key,
            'Authorization': 'Bearer ' + key
          },
          body: JSON.stringify({ markdown: editor.value })
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to save changes');
        }

        showToast('Document saved successfully!');
      } catch (err) {
        showToast(err.message, true);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
    }
  </script>
</body>
</html>`;
}
