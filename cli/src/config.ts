import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AgentPagesConfig {
  workerUrl: string;
  adminSecret?: string;
}

const CONFIG_DIR = path.join(os.homedir(), '.agentpages');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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
