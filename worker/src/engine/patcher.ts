import { OutlineItem } from '../types';

export function generateRandomId(length = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[array[i] % chars.length];
  }
  return id;
}

export function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  const lines = markdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('<!--') && !trimmed.startsWith('---')) {
      return trimmed.slice(0, 60);
    }
  }
  return 'Untitled Document';
}

export function extractOutline(markdown: string): OutlineItem[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const items: { level: number; heading: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    items.push({
      level: match[1].length,
      heading: match[2].trim(),
      index: match.index
    });
  }

  const result: OutlineItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const current = items[i];
    const nextIndex = i + 1 < items.length ? items[i + 1].index : markdown.length;
    const charCount = nextIndex - current.index;
    result.push({
      level: current.level,
      heading: current.heading,
      char_count: charCount
    });
  }

  return result;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function replaceSection(markdown: string, targetHeading: string, newContent: string): string {
  const cleanTarget = targetHeading.replace(/^#+\s*/, '').trim();
  const escaped = escapeRegExp(cleanTarget);
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, 'm');
  const match = headingPattern.exec(markdown);

  if (!match) {
    throw new Error(`Section with heading "${cleanTarget}" was not found in the document.`);
  }

  const headingLevel = match[1].length;
  const headingLine = match[0];
  const startIndex = match.index + headingLine.length;

  const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}}\\s+`, 'gm');
  nextHeadingPattern.lastIndex = startIndex;
  const nextMatch = nextHeadingPattern.exec(markdown);

  const endIndex = nextMatch ? nextMatch.index : markdown.length;

  const before = markdown.slice(0, startIndex);
  const after = markdown.slice(endIndex);

  const formattedContent = newContent.startsWith('\n') ? newContent : `\n\n${newContent.trim()}\n\n`;

  return `${before}${formattedContent}${after}`.replace(/\n{3,}/g, '\n\n');
}

export function appendToSection(markdown: string, targetHeading: string, addition: string): string {
  const cleanTarget = targetHeading.replace(/^#+\s*/, '').trim();
  const escaped = escapeRegExp(cleanTarget);
  const headingPattern = new RegExp(`^(#{1,6})\\s+${escaped}\\s*$`, 'm');
  const match = headingPattern.exec(markdown);

  if (!match) {
    throw new Error(`Section with heading "${cleanTarget}" was not found in the document.`);
  }

  const headingLevel = match[1].length;
  const headingLine = match[0];
  const startIndex = match.index + headingLine.length;

  const nextHeadingPattern = new RegExp(`^#{1,${headingLevel}}\\s+`, 'gm');
  nextHeadingPattern.lastIndex = startIndex;
  const nextMatch = nextHeadingPattern.exec(markdown);

  const insertIndex = nextMatch ? nextMatch.index : markdown.length;

  const before = markdown.slice(0, insertIndex).trimEnd();
  const after = markdown.slice(insertIndex);

  const formattedAddition = addition.trim();

  return `${before}\n\n${formattedAddition}\n\n${after}`.replace(/\n{3,}/g, '\n\n');
}

export function replaceText(markdown: string, find: string, replace: string): string {
  const index = markdown.indexOf(find);
  if (index === -1) {
    throw new Error(`Target text to replace was not found in the document.`);
  }
  return markdown.slice(0, index) + replace + markdown.slice(index + find.length);
}
