import { describe, it, expect } from 'vitest';
import {
  extractTitle,
  extractOutline,
  replaceSection,
  replaceText,
  appendToSection,
  generateRandomId,
} from '../src/engine/patcher';

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
});
