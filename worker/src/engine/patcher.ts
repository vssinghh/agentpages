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
  const headings = findHeadings(markdown);
  const h1 = headings.find((h) => h.level === 1);
  if (h1) {
    return h1.heading;
  }
  if (headings.length > 0) {
    return headings[0].heading;
  }

  const lines = markdown.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('<!--') && !trimmed.startsWith('---') && !trimmed.startsWith('```')) {
      return trimmed.slice(0, 60);
    }
  }
  return 'Untitled Document';
}

export interface HeadingMatch {
  level: number;
  heading: string;
  index: number;
  endIndex: number;
  path: string[];
}

export function findHeadings(markdown: string): HeadingMatch[] {
  const lines = markdown.split(/\r?\n/);
  const headings: HeadingMatch[] = [];
  let currentIndex = 0;
  let inCodeFence = false;
  let codeFenceChar = '';
  const currentPath: { level: number; heading: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = currentIndex;
    currentIndex += line.length + 1; // +1 for the newline separator
    const trimmed = line.trimStart();

    // Check for fenced code block start or end (``` or ~~~)
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!inCodeFence) {
        inCodeFence = true;
        codeFenceChar = marker[0];
      } else if (marker[0] === codeFenceChar) {
        inCodeFence = false;
        codeFenceChar = '';
      }
      continue;
    }

    if (inCodeFence) {
      continue;
    }

    // Markdown heading: 1-6 '#' followed by whitespace
    const headingMatch = line.match(/^(\#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // Strip trailing hashes (e.g. "## Heading ##" -> "Heading")
      const rawHeading = headingMatch[2].replace(/\s+#+\s*$/, '').trim();

      while (currentPath.length > 0 && currentPath[currentPath.length - 1].level >= level) {
        currentPath.pop();
      }
      currentPath.push({ level, heading: rawHeading });

      headings.push({
        level,
        heading: rawHeading,
        index: lineStart,
        endIndex: Math.min(currentIndex, markdown.length),
        path: currentPath.map((p) => p.heading),
      });
    }
  }

  return headings;
}

export function extractOutline(markdown: string): OutlineItem[] {
  const headings = findHeadings(markdown);
  const result: OutlineItem[] = [];

  for (let i = 0; i < headings.length; i++) {
    const current = headings[i];
    const nextIndex = i + 1 < headings.length ? headings[i + 1].index : markdown.length;
    const charCount = nextIndex - current.index;
    result.push({
      level: current.level,
      heading: current.heading,
      char_count: charCount,
    });
  }

  return result;
}

function matchTargetHeading(h: HeadingMatch, target: string): boolean {
  const cleanTarget = target.replace(/^#+\s*/, '').trim().toLowerCase();
  if (cleanTarget.includes('>')) {
    const targetPath = cleanTarget
      .split('>')
      .map((s) => s.trim())
      .join(' > ');
    const fullPath = h.path.map((s) => s.toLowerCase()).join(' > ');
    return fullPath.endsWith(targetPath) || fullPath === targetPath;
  }
  return h.heading.trim().toLowerCase() === cleanTarget;
}

export function replaceSection(markdown: string, targetHeading: string, newContent: string): string {
  const headings = findHeadings(markdown);
  const targetIndex = headings.findIndex((h) => matchTargetHeading(h, targetHeading));

  if (targetIndex === -1) {
    const cleanTarget = targetHeading.replace(/^#+\s*/, '').trim();
    throw new Error(`Section with heading "${cleanTarget}" was not found in the document.`);
  }

  const matched = headings[targetIndex];
  const nextHeading = headings.slice(targetIndex + 1).find((h) => h.level <= matched.level);
  const endIndex = nextHeading ? nextHeading.index : markdown.length;

  const before = markdown.slice(0, matched.endIndex);
  const after = markdown.slice(endIndex);

  const formattedContent = newContent.startsWith('\n') ? newContent : `\n\n${newContent.trim()}\n\n`;

  return `${before}${formattedContent}${after}`.replace(/\n{3,}/g, '\n\n');
}

export function appendToSection(markdown: string, targetHeading: string, addition: string): string {
  const headings = findHeadings(markdown);
  const targetIndex = headings.findIndex((h) => matchTargetHeading(h, targetHeading));

  if (targetIndex === -1) {
    const cleanTarget = targetHeading.replace(/^#+\s*/, '').trim();
    throw new Error(`Section with heading "${cleanTarget}" was not found in the document.`);
  }

  const matched = headings[targetIndex];
  const nextHeading = headings.slice(targetIndex + 1).find((h) => h.level <= matched.level);
  const insertIndex = nextHeading ? nextHeading.index : markdown.length;

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
