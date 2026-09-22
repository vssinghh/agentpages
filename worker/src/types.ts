export interface Env {
  DOCS_KV: KVNamespace;
  ADMIN_SECRET?: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  markdown: string;
  edit_key: string;
  created_at: string;
  updated_at: string;
  version: number;
  ttl_seconds?: number;
}

export interface PublishRequest {
  markdown: string;
  title?: string;
  custom_slug?: string;
  ttl_seconds?: number;
}

export type PatchAction = 'replace_section' | 'replace_text' | 'append_to_section';

export interface PatchRequest {
  action: PatchAction;
  heading?: string;
  content?: string;
  find?: string;
  replace?: string;
}

export interface OutlineItem {
  level: number;
  heading: string;
  char_count: number;
}

export interface DocumentOutline {
  id: string;
  title: string;
  total_length: number;
  outline: OutlineItem[];
}
