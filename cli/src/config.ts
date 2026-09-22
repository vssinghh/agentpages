import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AgentPagesConfig {
  workerUrl: string;
  adminSecret?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.agentpages');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const KEYS_FILE = path.join(CONFIG_DIR, 'keys.json');

export function loadConfig(): AgentPagesConfig {
  let fileConfig: Partial<AgentPagesConfig> = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Ignore corrupted config file and rely on fallbacks
    }
  }

  const workerUrl =
    process.env.AGENTPAGES_URL ||
    process.env.AGENT_MD_URL ||
    fileConfig.workerUrl ||
    '';

  const adminSecret =
    process.env.AGENTPAGES_SECRET ||
    process.env.AGENT_MD_SECRET ||
    fileConfig.adminSecret ||
    '';

  return {
    workerUrl: workerUrl.replace(/\/+$/, ''),
    adminSecret,
  };
}

export function saveConfig(config: AgentPagesConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const cleanConfig: AgentPagesConfig = {
    workerUrl: config.workerUrl.replace(/\/+$/, ''),
    adminSecret: config.adminSecret || '',
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cleanConfig, null, 2), {
    mode: 0o600,
  });
}

export function saveDocKey(docId: string, editKey: string): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
    let keys: Record<string, string> = {};
    if (fs.existsSync(KEYS_FILE)) {
      keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
    }
    keys[docId] = editKey;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 });
  } catch {
    // Non-critical local cache error
  }
}

export function getDocKey(docId: string): string | undefined {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const keys = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf-8'));
      return keys[docId];
    }
  } catch {
    // Ignore read errors
  }
  return undefined;
}
