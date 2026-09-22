import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AgentMdConfig {
  workerUrl: string;
  adminSecret?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.agent-md');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export function loadConfig(): AgentMdConfig {
  let fileConfig: Partial<AgentMdConfig> = {};

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch {
      // Ignore corrupted config file and rely on fallbacks
    }
  }

  const workerUrl = process.env.AGENT_MD_URL || fileConfig.workerUrl || '';
  const adminSecret = process.env.AGENT_MD_SECRET || fileConfig.adminSecret || '';

  return {
    workerUrl: workerUrl.replace(/\/+$/, ''),
    adminSecret,
  };
}

export function saveConfig(config: AgentMdConfig): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }

  const cleanConfig: AgentMdConfig = {
    workerUrl: config.workerUrl.replace(/\/+$/, ''),
    adminSecret: config.adminSecret || '',
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cleanConfig, null, 2), {
    mode: 0o600,
  });
}
