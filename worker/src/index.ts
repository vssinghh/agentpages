import { Env, DocumentRecord, PublishRequest, PatchRequest } from './types';
import { generateRandomId, extractTitle, extractOutline, replaceSection, replaceText, appendToSection } from './engine/patcher';
import { renderMarkdown } from './engine/renderer';
import { renderReaderView } from './views/reader';
import { renderEditorView } from './views/editor';

function corsHeaders(): HeadersInit {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Edit-Key',
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

function verifyAuth(request: Request, env: Env, doc?: DocumentRecord): boolean {
  const authHeader = request.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const editKeyHeader = request.headers.get('X-Edit-Key') || '';

  if (env.ADMIN_SECRET && env.ADMIN_SECRET.trim().length > 0) {
    if (bearerToken === env.ADMIN_SECRET.trim()) {
      return true;
    }
  }

  if (doc) {
    if (editKeyHeader && editKeyHeader === doc.edit_key) {
      return true;
    }
    if (bearerToken && bearerToken === doc.edit_key) {
      return true;
    }
  }

  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.trim().length === 0) {
    if (!doc) {
      return true;
    }
  }

  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    // Landing / Documentation page
    if (path === '/' && method === 'GET') {
      return new Response(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>agent-md &bull; Agent-First Markdown Publishing</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 680px; margin: 4rem auto; padding: 0 1.5rem; line-height: 1.6; color: #1f2937; }
    code { background: #f3f4f6; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; }
    pre { background: #f3f4f6; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>agent-md Edge Worker</h1>
  <p>An open-source, serverless publishing and surgical editing engine for AI agents and developers.</p>
  <h3>CLI Quick Start</h3>
  <pre>npm install -g agent-md\nagent-md login\nagent-md publish spec.md</pre>
  <p>Learn more on <a href="https://github.com">GitHub</a>.</p>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Reader View: GET /p/:id
    const readerMatch = path.match(/^\/p\/([a-zA-Z0-9_-]+)$/);
    if (readerMatch && method === 'GET') {
      const id = readerMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return new Response('Document not found or expired', { status: 404 });
      }
      const doc: DocumentRecord = JSON.parse(raw);
      const renderedHtml = renderMarkdown(doc.markdown);
      return new Response(renderReaderView(doc, renderedHtml), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // In-Browser Editor View: GET /p/:id/edit
    const editorMatch = path.match(/^\/p\/([a-zA-Z0-9_-]+)\/edit$/);
    if (editorMatch && method === 'GET') {
      const id = editorMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return new Response('Document not found or expired', { status: 404 });
      }
      const doc: DocumentRecord = JSON.parse(raw);
      return new Response(renderEditorView(doc), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Publish API: POST /api/publish
    if (path === '/api/publish' && method === 'POST') {
      if (!verifyAuth(request, env)) {
        return jsonResponse({ error: 'Unauthorized: Invalid or missing admin credentials' }, 401);
      }

      let markdown = '';
      let customSlug: string | undefined;
      let ttlSeconds: number | undefined;

      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = (await request.json()) as PublishRequest;
        markdown = body.markdown || '';
        customSlug = body.custom_slug;
        ttlSeconds = body.ttl_seconds;
      } else {
        markdown = await request.text();
      }

      if (!markdown || markdown.trim().length === 0) {
        return jsonResponse({ error: 'Markdown content cannot be empty' }, 400);
      }

      let id = customSlug ? customSlug.trim() : generateRandomId(8);
      id = id.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

      const existing = await env.DOCS_KV.get(`doc:${id}`);
      if (existing && customSlug) {
        return jsonResponse({ error: `Slug "${id}" already exists` }, 409);
      }

      const title = extractTitle(markdown);
      const editKey = generateRandomId(12);
      const now = new Date().toISOString();

      const docRecord: DocumentRecord = {
        id,
        title,
        markdown,
        edit_key: editKey,
        created_at: now,
        updated_at: now,
        version: 1,
        ttl_seconds: ttlSeconds,
      };

      const putOptions = ttlSeconds && ttlSeconds > 60 ? { expirationTtl: ttlSeconds } : undefined;
      await env.DOCS_KV.put(`doc:${id}`, JSON.stringify(docRecord), putOptions);

      const publicUrl = `${url.origin}/p/${id}`;
      return jsonResponse(
        {
          status: 'success',
          id,
          url: publicUrl,
          edit_key: editKey,
          title,
          created_at: now,
        },
        201
      );
    }

    // Outline API: GET /api/document/:id/outline
    const outlineMatch = path.match(/^\/api\/document\/([a-zA-Z0-9_-]+)\/outline$/);
    if (outlineMatch && method === 'GET') {
      const id = outlineMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      const doc: DocumentRecord = JSON.parse(raw);
      const outline = extractOutline(doc.markdown);
      return jsonResponse({
        id: doc.id,
        title: doc.title,
        total_length: doc.markdown.length,
        version: doc.version,
        outline,
      });
    }

    // Document Details API: GET /api/document/:id
    const getDocMatch = path.match(/^\/api\/document\/([a-zA-Z0-9_-]+)$/);
    if (getDocMatch && method === 'GET') {
      const id = getDocMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      const doc: DocumentRecord = JSON.parse(raw);
      return jsonResponse({
        id: doc.id,
        title: doc.title,
        markdown: doc.markdown,
        version: doc.version,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
      });
    }

    // Surgical Patch API: PATCH /api/document/:id
    const patchMatch = path.match(/^\/api\/document\/([a-zA-Z0-9_-]+)$/);
    if (patchMatch && method === 'PATCH') {
      const id = patchMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      const doc: DocumentRecord = JSON.parse(raw);

      if (!verifyAuth(request, env, doc)) {
        return jsonResponse({ error: 'Unauthorized: Invalid edit credentials' }, 403);
      }

      const body = (await request.json()) as PatchRequest;
      let updatedMarkdown = doc.markdown;

      try {
        switch (body.action) {
          case 'replace_section': {
            if (!body.heading || body.content === undefined) {
              return jsonResponse({ error: 'replace_section requires heading and content parameters' }, 400);
            }
            updatedMarkdown = replaceSection(doc.markdown, body.heading, body.content);
            break;
          }
          case 'replace_text': {
            if (!body.find || body.replace === undefined) {
              return jsonResponse({ error: 'replace_text requires find and replace parameters' }, 400);
            }
            updatedMarkdown = replaceText(doc.markdown, body.find, body.replace);
            break;
          }
          case 'append_to_section': {
            if (!body.heading || !body.content) {
              return jsonResponse({ error: 'append_to_section requires heading and content parameters' }, 400);
            }
            updatedMarkdown = appendToSection(doc.markdown, body.heading, body.content);
            break;
          }
          default:
            return jsonResponse({ error: `Unsupported patch action: ${body.action}` }, 400);
        }
      } catch (err: any) {
        return jsonResponse({ error: err.message || 'Patch failed' }, 400);
      }

      doc.markdown = updatedMarkdown;
      doc.title = extractTitle(updatedMarkdown);
      doc.version += 1;
      doc.updated_at = new Date().toISOString();

      await env.DOCS_KV.put(`doc:${id}`, JSON.stringify(doc));

      return jsonResponse({
        status: 'success',
        id: doc.id,
        action: body.action,
        version: doc.version,
        updated_at: doc.updated_at,
        url: `${url.origin}/p/${doc.id}`,
      });
    }

    // Full Update API: PUT /api/document/:id
    const putMatch = path.match(/^\/api\/document\/([a-zA-Z0-9_-]+)$/);
    if (putMatch && method === 'PUT') {
      const id = putMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      const doc: DocumentRecord = JSON.parse(raw);

      if (!verifyAuth(request, env, doc)) {
        return jsonResponse({ error: 'Unauthorized: Invalid edit credentials' }, 403);
      }

      let newMarkdown = '';
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json() as { markdown?: string };
        newMarkdown = body.markdown || '';
      } else {
        newMarkdown = await request.text();
      }

      if (!newMarkdown || newMarkdown.trim().length === 0) {
        return jsonResponse({ error: 'Markdown content cannot be empty' }, 400);
      }

      doc.markdown = newMarkdown;
      doc.title = extractTitle(newMarkdown);
      doc.version += 1;
      doc.updated_at = new Date().toISOString();

      await env.DOCS_KV.put(`doc:${id}`, JSON.stringify(doc));

      return jsonResponse({
        status: 'success',
        id: doc.id,
        version: doc.version,
        updated_at: doc.updated_at,
        url: `${url.origin}/p/${doc.id}`,
      });
    }

    // Delete API: DELETE /api/document/:id
    const deleteMatch = path.match(/^\/api\/document\/([a-zA-Z0-9_-]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const id = deleteMatch[1];
      const raw = await env.DOCS_KV.get(`doc:${id}`);
      if (!raw) {
        return jsonResponse({ error: 'Document not found' }, 404);
      }
      const doc: DocumentRecord = JSON.parse(raw);

      if (!verifyAuth(request, env, doc)) {
        return jsonResponse({ error: 'Unauthorized: Invalid credentials' }, 403);
      }

      await env.DOCS_KV.delete(`doc:${id}`);
      return jsonResponse({ status: 'success', message: `Document ${id} deleted` });
    }

    return new Response('Not Found', { status: 404 });
  },
};
