#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs';
import readline from 'readline';
import { loadConfig, saveConfig, saveDocKey, getDocKey } from './config';
import { AgentPagesClient } from './client';

const program = new Command();

program
  .name('agentpages')
  .description('Agent-first markdown publishing and surgical editing CLI')
  .version('0.1.0');

// Login / Setup command
program
  .command('login')
  .description('Configure Worker URL and admin credentials')
  .option('-u, --url <url>', 'Cloudflare Worker URL (e.g. https://my-docs.workers.dev)')
  .option('-s, --secret <secret>', 'Admin secret password')
  .action(async (options) => {
    let url = options.url;
    let secret = options.secret;

    if (!url) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const question = (query: string): Promise<string> => {
        return new Promise((resolve) => rl.question(query, resolve));
      };

      url = await question('Enter your Cloudflare Worker URL: ');
      secret = await question('Enter your Admin Secret (optional, press enter to skip): ');
      rl.close();
    }

    if (!url || !url.trim()) {
      console.error('Error: Worker URL is required.');
      process.exit(1);
    }

    saveConfig({
      workerUrl: url.trim(),
      adminSecret: secret ? secret.trim() : '',
    });

    console.log('Configuration saved successfully to ~/.agentpages/config.json');
  });

// Publish command
program
  .command('publish [file]')
  .description('Publish a markdown file to the web')
  .option('-s, --slug <slug>', 'Custom slug/ID for the document')
  .option('-t, --ttl <ttl>', 'Expiration time (e.g. 24h, 7d, 30m)')
  .option('--json', 'Output response as JSON for agents')
  .action(async (file, options) => {
    try {
      let content = '';
      if (!file || file === '-') {
        content = fs.readFileSync(0, 'utf-8');
      } else {
        if (!fs.existsSync(file)) {
          console.error(`Error: File "${file}" does not exist.`);
          process.exit(1);
        }
        content = fs.readFileSync(file, 'utf-8');
      }

      const config = loadConfig();
      const client = new AgentPagesClient(config);
      const res = await client.publish(content, {
        slug: options.slug,
        ttl: options.ttl,
      });

      if (res.id && res.edit_key) {
        saveDocKey(res.id as string, res.edit_key as string);
      }

      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(`\nPublished successfully!`);
        console.log(`URL:      ${res.url}`);
        console.log(`Doc ID:   ${res.id}`);
        console.log(`Edit Key: ${res.edit_key}\n`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Outline command
program
  .command('outline <id>')
  .description('Inspect document outline (token-efficient outline inspection)')
  .option('--json', 'Output response as JSON for agents')
  .action(async (id, options) => {
    try {
      const config = loadConfig();
      const client = new AgentPagesClient(config);
      const data = await client.getOutline(id);

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`\nTitle: ${data.title} (${data.total_length} characters)`);
        console.log(`Document ID: ${data.id}\n`);
        const outline = (data.outline as Array<{ level: number; heading: string; char_count: number }>) || [];
        for (const item of outline) {
          const indent = '  '.repeat(item.level - 1);
          console.log(`${indent}# ${item.heading} [${item.char_count} chars]`);
        }
        console.log('');
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Patch command
program
  .command('patch <id>')
  .description('Surgically patch a section, text snippet, or append content')
  .option('--section <heading>', 'Heading of section to target')
  .option('--content <content>', 'New content for section replacement')
  .option('--find <text>', 'Text snippet to find')
  .option('--replace <text>', 'Replacement text for exact string match')
  .option('--append <content>', 'Content to append to target section')
  .option('-k, --edit-key <key>', 'Document edit key if not using admin secret')
  .option('--json', 'Output response as JSON for agents')
  .action(async (id, options) => {
    try {
      let patchPayload: Record<string, unknown>;

      if (options.find && options.replace !== undefined) {
        patchPayload = {
          action: 'replace_text',
          find: options.find,
          replace: options.replace,
        };
      } else if (options.section && options.append) {
        patchPayload = {
          action: 'append_to_section',
          heading: options.section,
          content: options.append,
        };
      } else if (options.section && options.content !== undefined) {
        patchPayload = {
          action: 'replace_section',
          heading: options.section,
          content: options.content,
        };
      } else {
        console.error(
          'Error: Invalid patch arguments. Provide either:\n' +
            '  --section <name> --content <text>\n' +
            '  --find <text> --replace <text>\n' +
            '  --section <name> --append <text>'
        );
        process.exit(1);
      }

      const config = loadConfig();
      const client = new AgentPagesClient(config);
      const effectiveKey = options.editKey || getDocKey(id);
      const res = await client.patch(id, patchPayload, effectiveKey);

      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(`\nPatch applied successfully!`);
        console.log(`Document: ${res.url}`);
        console.log(`Version:  v${res.version}\n`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Get document command
program
  .command('get <id>')
  .description('Fetch raw markdown of a published document')
  .option('--json', 'Output as JSON with metadata')
  .action(async (id, options) => {
    try {
      const config = loadConfig();
      const client = new AgentPagesClient(config);
      const doc = await client.getDocument(id);

      if (options.json) {
        console.log(JSON.stringify(doc, null, 2));
      } else {
        process.stdout.write(doc.markdown as string);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

// Delete command
program
  .command('delete <id>')
  .description('Delete a published document')
  .option('-k, --edit-key <key>', 'Document edit key if not using admin secret')
  .option('--json', 'Output response as JSON')
  .action(async (id, options) => {
    try {
      const config = loadConfig();
      const client = new AgentPagesClient(config);
      const effectiveKey = options.editKey || getDocKey(id);
      const res = await client.delete(id, effectiveKey);

      if (options.json) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        console.log(`\nDocument ${id} successfully deleted.\n`);
      }
    } catch (err: any) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
