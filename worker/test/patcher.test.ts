import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  extractOutline,
  replaceSection,
  replaceText,
  appendToSection,
  generateRandomId,
} from '../src/engine/patcher';
import { renderMarkdown, sanitizeHtml } from '../src/engine/renderer';

describe('Surgical Patcher Engine', () => {
  const sampleDoc = `# My Project Spec

Intro paragraph here.

## Architecture

We use edge computing.
Sub-detail line.

### Database

Postgres on Supabase.

## Roadmap

* Item 1
* Item 2
`;

  it('generates random alphanumeric IDs of desired length', () => {
    const id = generateRandomId(8);
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it('extracts title from primary heading', () => {
    expect(extractTitle(sampleDoc)).toBe('My Project Spec');
  });

  it('extracts hierarchical outline with character counts', () => {
    const outline = extractOutline(sampleDoc);
    expect(outline).toHaveLength(4);
    expect(outline[0]).toEqual({ level: 1, heading: 'My Project Spec', char_count: expect.any(Number) });
    expect(outline[1]).toEqual({ level: 2, heading: 'Architecture', char_count: expect.any(Number) });
    expect(outline[2]).toEqual({ level: 3, heading: 'Database', char_count: expect.any(Number) });
    expect(outline[3]).toEqual({ level: 2, heading: 'Roadmap', char_count: expect.any(Number) });
  });

  it('surgically replaces a section body without altering other sections', () => {
    const updated = replaceSection(
      sampleDoc,
      'Architecture',
      'We use Cloudflare Workers with global sub-50ms edge routing.'
    );

    expect(updated).toContain('## Architecture\n\nWe use Cloudflare Workers with global sub-50ms edge routing.\n\n## Roadmap');
    expect(updated).toContain('# My Project Spec');
    expect(updated).toContain('## Roadmap');
    expect(updated).not.toContain('Sub-detail line.');
    expect(updated).not.toContain('Postgres on Supabase.');
  });

  it('surgically replaces a leaf subsection', () => {
    const updated = replaceSection(
      sampleDoc,
      'Database',
      'Cloudflare KV Key-Value store.'
    );

    expect(updated).toContain('### Database\n\nCloudflare KV Key-Value store.\n\n## Roadmap');
    expect(updated).toContain('We use edge computing.');
  });

  it('throws helpful error when target section does not exist', () => {
    expect(() => {
      replaceSection(sampleDoc, 'NonExistentSection', 'Some content');
    }).toThrowError(/not found in the document/);
  });

  it('replaces exact text snippets cleanly', () => {
    const updated = replaceText(sampleDoc, 'Postgres on Supabase', 'SQLite on Cloudflare D1');
    expect(updated).toContain('SQLite on Cloudflare D1.');
    expect(updated).not.toContain('Postgres on Supabase');
  });

  it('throws error when text snippet to replace is not found', () => {
    expect(() => {
      replaceText(sampleDoc, 'non-existent text snippet', 'replacement');
    }).toThrowError(/Target text to replace was not found/);
  });

  it('appends text to the end of a section before the next heading', () => {
    const updated = appendToSection(sampleDoc, 'Roadmap', '* Item 3: Ship MVP');
    expect(updated).toContain('* Item 2\n\n* Item 3: Ship MVP');
  });

  it('ignores comments and hashes inside code blocks', () => {
    const codeDoc = `# API Docs

## Code Samples

Here is Python code:

\`\`\`python
# This is a python comment, not a heading!
def connect():
    # Another comment
    return True
\`\`\`

## Deployment

Deploy steps here.
`;

    const outline = extractOutline(codeDoc);
    expect(outline).toHaveLength(3);
    expect(outline.map((o) => o.heading)).toEqual(['API Docs', 'Code Samples', 'Deployment']);

    // Replacing Code Samples must not stop at python comments
    const updated = replaceSection(codeDoc, 'Code Samples', 'Code samples moved to docs.');
    expect(updated).toContain('## Code Samples\n\nCode samples moved to docs.\n\n## Deployment');
    expect(updated).not.toContain('def connect()');
  });

  it('handles regex special characters in heading titles', () => {
    const specialDoc = `# Title

## C++ & Special [Chars] (v1.0)?

Details about C++ and regex symbols.

## Next Section

Finished.
`;

    const outline = extractOutline(specialDoc);
    expect(outline[1].heading).toBe('C++ & Special [Chars] (v1.0)?');

    const updated = replaceSection(
      specialDoc,
      'C++ & Special [Chars] (v1.0)?',
      'Updated content with special symbols successfully.'
    );
    expect(updated).toContain('Updated content with special symbols successfully.');
    expect(updated).toContain('## Next Section');
  });

  it('supports hierarchical heading paths to resolve duplicate names', () => {
    const multiDoc = `# System

## Backend
### Storage
SQL Database

## Frontend
### Storage
Local Storage
`;

    const updated = replaceSection(multiDoc, 'Frontend > Storage', 'IndexedDB cache');
    expect(updated).toContain('SQL Database');
    expect(updated).toContain('IndexedDB cache');
    expect(updated).not.toContain('Local Storage');
  });

  it('handles Unicode and emoji in headings', () => {
    const unicodeDoc = `# 🚀 Project Alpha

## 📦 架构设计 (Architecture)

中文内容描述。

## 🎯 目标 (Goals)

Global edge delivery.
`;

    const outline = extractOutline(unicodeDoc);
    expect(outline[0].heading).toBe('🚀 Project Alpha');
    expect(outline[1].heading).toBe('📦 架构设计 (Architecture)');

    const updated = replaceSection(unicodeDoc, '📦 架构设计 (Architecture)', '更新的架构说明。');
    expect(updated).toContain('更新的架构说明。');
    expect(updated).toContain('## 🎯 目标 (Goals)');
  });

  it('sanitizes HTML to prevent script injection (XSS)', () => {
    const maliciousDoc = `# Test Page

<script>alert("xss")</script>
<img src="x" onerror="alert(1)">
<iframe src="https://evil.com"></iframe>

[Normal Link](https://example.com)
`;

    const html = renderMarkdown(maliciousDoc);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('alert("xss")');
    expect(html).not.toContain('onerror=');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('href="https://example.com"');
  });
});
