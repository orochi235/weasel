/**
 * A disabled control fades, and fading alone reads like subtle text at the same alpha, so it also desaturates
 * onto the neutral ramp. This fails on a rule whose selector is a disabled state and that sets an opacity below 1
 * without the shared cue beside it:
 *
 *   filter: var(--wzl-disabled-filter);
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

const CUE = /^filter\s*:\s*var\(\s*--wzl-disabled-filter\s*\)$/;
const FADE = /^opacity\s*:\s*([\d.]+)(%?)$/;

const isDisabledState = (selectors: readonly string[]): boolean =>
  selectors.some((s) => /disabled/i.test(s.replace(/:not\((?:[^()]|\([^()]*\))*\)/g, '')));

export function disabledOffenders(path: string, source: string): Offender[] {
  const clean = stripComments(source);
  const out: Offender[] = [];
  for (const { selectors, decls } of blocks(clean)) {
    if (!isDisabledState(selectors)) continue;
    const fade = decls.find((d) => {
      const m = FADE.exec(d.text);
      return m !== null && Number(m[1]) / (m[2] ? 100 : 1) < 1;
    });
    if (!fade || decls.some((d) => CUE.test(d.text))) continue;
    out.push({ file: path, line: lineAt(clean, fade.index), text: fade.text });
  }
  return out;
}

if (process.argv[1]?.endsWith('check-disabled.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]
    .map((p) => relative(root, p))
    .filter((p) => /\.(css|less)$/.test(p));
  const bad = files.flatMap((p) => disabledOffenders(p, readFileSync(join(root, p), 'utf8')));
  for (const o of bad) {
    console.error(`${o.file}:${o.line}  a disabled fade also sets filter: var(--wzl-disabled-filter)  ${o.text}`);
  }
  console.log(`${files.length} stylesheets, ${bad.length} disabled-cue offender(s)`);
  process.exit(bad.length === 0 ? 0 : 1);
}
