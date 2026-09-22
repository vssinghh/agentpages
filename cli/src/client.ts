import { AgentMdConfig } from './config';

export function parseTtlToSeconds(ttlStr?: string): number | undefined {
  if (!ttlStr) return undefined;
  const match = ttlStr.trim().match(/^(\d+)([smhd])$/i);
  if (!match) return undefined;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return undefined;
  }
}

export class AgentMdClient {
  constructor(private config: AgentMdConfig) {
    if (!config.workerUrl) {
      throw new Error(
        'Worker URL is not configured. Run "agent-md login" or set AGENT_MD_URL environment variable.'
      );
    }
  }

  private getHeaders(editKey?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.adminSecret) {
      headers['Authorization'] = `Bearer ${this.config.adminSecret}`;
    }
    if (editKey) {
      headers['X-Edit-Key'] = editKey;
    }
    return headers;
  }

  async publish(markdown: string, options: { slug?: string; ttl?: string } = {}) {
    const ttlSeconds = parseTtlToSeconds(options.ttl);
    const body: Record<string, unknown> = {
      markdown,
    };
    if (options.slug) body.custom_slug = options.slug;
    if (ttlSeconds) body.ttl_seconds = ttlSeconds;

    const res = await fetch(`${this.config.workerUrl}/api/publish`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) || `Publish failed with status ${res.status}`);
    }
    return data;
  }

  async getOutline(id: string) {
    const res = await fetch(`${this.config.workerUrl}/api/document/${id}/outline`);
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) || `Failed to fetch outline for ${id}`);
    }
    return data;
  }

  async getDocument(id: string) {
    const res = await fetch(`${this.config.workerUrl}/api/document/${id}`);
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) || `Failed to fetch document ${id}`);
    }
    return data;
  }

  async patch(id: string, patchPayload: Record<string, unknown>, editKey?: string) {
    const res = await fetch(`${this.config.workerUrl}/api/document/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(editKey),
      body: JSON.stringify(patchPayload),
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) || `Patch failed with status ${res.status}`);
    }
    return data;
  }

  async delete(id: string, editKey?: string) {
    const res = await fetch(`${this.config.workerUrl}/api/document/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(editKey),
    });

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      throw new Error((data.error as string) || `Delete failed with status ${res.status}`);
    }
    return data;
  }
}
