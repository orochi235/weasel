/**
 * A rule that sets `color: var(--wzl-fg-on-accent)` is text on an accent fill, where the general
 * `--wzl-fg-muted` / `--wzl-fg-subtle` alphas fall below WCAG 4.5:1. So the same rule redirects
 * both to their on-accent pair, and this fails on one that doesn't:
 *
 *   --wzl-fg-muted: var(--wzl-fg-muted-on-accent);
 *   --wzl-fg-subtle: var(--wzl-fg-subtle-on-accent);
 *
 * Runs under tsx so it shares the root tsconfig's resolution, like its siblings.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { blocks, lineAt, stripComments, walk } from './lib/cssBlocks.ts';

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

const ON_ACCENT_TEXT = /^color\s*:\s*var\(\s*--wzl-fg-on-accent\s*\)$/;
const REDIRECTS = [
  /^--wzl-fg-muted\s*:\s*var\(\s*--wzl-fg-muted-on-accent\s*\)$/,
  /^--wzl-fg-subtle\s*:\s*var\(\s*--wzl-fg-subtle-on-accent\s*\)$/,
];

export function onAccentOffenders(path: string, source: string): Offender[] {
  const clean = stripComments(source);
  const out: Offender[] = [];
  for (const { decls } of blocks(clean)) {
    const text = decls.find((d) => ON_ACCENT_TEXT.test(d.text));
    if (!text) continue;
    if (REDIRECTS.every((r) => decls.some((d) => r.test(d.text)))) continue;
    out.push({ file: path, line: lineAt(clean, text.index), text: text.text });
  }
  return out;
}

if (process.argv[1]?.endsWith('check-on-accent.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]
    .map((p) => relative(root, p))
    .filter((p) => /\.(css|less)$/.test(p));
  const bad = files.flatMap((p) => onAccentOffenders(p, readFileSync(join(root, p), 'utf8')));
  for (const o of bad) {
    console.error(`${o.file}:${o.line}  redirect --wzl-fg-muted and --wzl-fg-subtle to their -on-accent pair  ${o.text}`);
  }
  console.log(`${files.length} stylesheets, ${bad.length} on-accent offender(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
