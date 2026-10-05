import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Comments blanked to spaces, so indices and line numbers survive. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|(?<![:'"])\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

export function lineAt(source: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) n += 1;
  return n;
}

/** Each block's own declarations — nested blocks are their own entries. */
export function blocks(source: string): { decls: { text: string; index: number }[] }[] {
  const out: { decls: { text: string; index: number }[] }[] = [];
  const stack: { decls: { text: string; index: number }[] }[] = [];
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    if (c !== '{' && c !== '}' && c !== ';') continue;
    const raw = source.slice(start, i);
    const text = raw.trim();
    const index = start + raw.length - raw.trimStart().length;
    if (c === '{') stack.push({ decls: [] });
    else {
      if (text && stack.length > 0) stack[stack.length - 1].decls.push({ text, index });
      if (c === '}') {
        const done = stack.pop();
        if (done) out.push(done);
      }
    }
    start = i + 1;
  }
  return out;
}

const SKIP = new Set(['node_modules', 'dist', 'dist-demo', 'dist-examples', 'generated', 'storybook-static']);

export function walk(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, into);
    else if (/\.(css|less|tsx?)$/.test(p) && !/\.(test|spec)\.tsx?$/.test(p) && !p.endsWith('.d.ts')) into.push(p);
  }
  return into;
}
