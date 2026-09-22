# agent-md

> An open-source, serverless publishing and surgical editing engine built for AI agents and developers.

[![Deploy with Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/vipinsingh/agent-md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

`agent-md` allows terminal agents, IDE assistants, and autonomous pipelines to publish markdown documents to the web with one command and perform token-efficient surgical patches to existing documents.

---

## 1. First Principles

* **What is it?**
  A personal edge microservice deployed to Cloudflare Workers with an accompanying CLI tool. It takes markdown files, renders them as fast public web pages, and exposes an API for surgical section edits.
* **Why do we use it?**
  Publishing documents usually means paying for closed SaaS platforms or sharing unstyled code gists. When editing documents, AI agents are typically forced to rewrite entire 5,000-word files, wasting thousands of output tokens. `agent-md` is 100% free forever and allows agents to patch specific sections using single-sentence tool calls.
* **How do we use it?**
  Deploy the Worker with one click to your free Cloudflare account. Use the `agent-md` CLI to publish, inspect outlines, and patch sections.
* **Which teams use it?**
  Engineers publishing Architecture Decision Records (ADRs), autonomous coding agents sharing runbooks and research memos, and technical writers sharing project briefs.

---

## 2. Key Features

* **100% Free Edge Hosting**: Runs entirely on Cloudflare's permanent free tier (100,000 requests/day, 1 GB KV storage, zero server bills).
* **Token-Efficient Surgical Edits**: Agents can inspect document outlines and replace individual sections or text snippets without rewriting the entire document.
* **1-Click Deployment**: Deployable to your personal Cloudflare account in under 60 seconds with no complex infrastructure setup.
* **Dual-Token Authorization**: Every document receives a unique `edit_key`, allowing collaboration and edits without exposing your master admin secret.
* **Configurable Expiration**: Permanent storage by default, with optional `--ttl` flags (e.g. `24h`, `7d`) for temporary shares.
* **Clean Reading & In-Browser Editing**: Rendered with GitHub Flavored Markdown, syntax-highlighted code blocks, KaTeX math rendering, and a built-in split-pane browser editor.

---

## 3. Quick Start

### Step 1: Deploy the Worker (One-Time Setup)

Click the **Deploy with Workers** button at the top of this repository, or clone and deploy via Wrangler:

```bash
cd worker
npm install
npx wrangler kv:namespace create DOCS_KV
# Update wrangler.toml with the returned KV id
npm run deploy
```

Copy your deployed Worker URL (for example, `https://my-docs.workers.dev`).

### Step 2: Install the CLI

```bash
npm install -g agent-md
```

### Step 3: Connect the CLI

```bash
agent-md login
```
Follow the interactive prompts to enter your Worker URL and optional Admin Secret. Credentials are saved locally to `~/.agent-md/config.json`.

Alternatively, set environment variables:
```bash
export AGENT_MD_URL="https://my-docs.workers.dev"
export AGENT_MD_SECRET="my-secret-key"
```

---

## 4. CLI Usage

### A. Publish a Document
```bash
# Human usage:
agent-md publish architecture.md

# Set an expiration time (e.g. 24 hours, 7 days):
agent-md publish meeting-notes.md --ttl 24h

# Agent usage (machine-readable JSON output):
agent-md publish spec.md --json
```

Output:
```json
{
  "status": "success",
  "id": "8f2a1b",
  "url": "https://my-docs.workers.dev/p/8f2a1b",
  "edit_key": "k9x2m4",
  "created_at": "2026-09-22T15:15:00Z"
}
```

---

### B. Inspect Document Outline
Before modifying a large document, agents can fetch the outline to identify headings and token weights:

```bash
agent-md outline 8f2a1b
```
Output:
```text
Title: My Project Spec (4,200 characters)
Document ID: 8f2a1b

# Architecture Spec [350 chars]
  # Database Schema [1200 chars]
  # Deployment Plan [800 chars]
```

Or machine-readable JSON:
```bash
agent-md outline 8f2a1b --json
```

---

### C. Surgical Patching (Token-Efficient Editing)

Instead of rewriting the entire document, agents send only the target section or text replacement:

#### 1. Replace a Section by Heading
Replaces everything under `## Database Schema` until the next heading of equal or higher level:
```bash
agent-md patch 8f2a1b \
  --section "Database Schema" \
  --content "Migrated to Cloudflare D1 for SQLite edge storage." \
  --json
```

#### 2. Exact Text Search and Replace
```bash
agent-md patch 8f2a1b \
  --find "status: draft" \
  --replace "status: stable" \
  --json
```

#### 3. Append to a Section
```bash
agent-md patch 8f2a1b \
  --section "Deployment Plan" \
  --append "* Verified global latency in us-east and eu-west." \
  --json
```

---

### D. Reading and Deleting
```bash
# Fetch raw markdown:
agent-md get 8f2a1b

# Delete document:
agent-md delete 8f2a1b
```

---

## 5. Token Economics: Full Rewrite vs. Surgical Patch

Comparing edits on an 8-page technical specification (~4,000 tokens):

| Strategy | Agent Input Tokens | Agent Output Tokens | Network Payload | Latency |
| :--- | :--- | :--- | :--- | :--- |
| **Full Document Rewrite** | ~4,000 | ~4,000 | ~16 KB | ~12 to 18 seconds |
| **agent-md Surgical Patch** | 0 to ~300 | ~35 | ~200 bytes | ~300 milliseconds |

The surgical approach saves over **98%** of LLM output tokens and applies updates in hundreds of milliseconds.

---

## 6. Architecture & Security

* **Edge KV Storage**: Documents are stored in Cloudflare Key-Value storage under `doc:<id>`.
* **Zero Database Maintenance**: No migrations, schemas, or container setups.
* **Dual-Token Model**:
  * `ADMIN_SECRET`: Configured in your Cloudflare Worker environment. Grants full write access to all documents.
  * `edit_key`: Generated per document. Allows collaborators or specific agents to edit a single document without granting administrative privileges to your entire vault.
* **In-Browser Editing**: Every published page at `/p/:id` includes an "Edit" button leading to `/p/:id/edit`. Changes can be saved directly in the browser by providing the `edit_key` or `ADMIN_SECRET`.

---

## 7. License

MIT License. Contributions, pull requests, and bug reports are welcome!
