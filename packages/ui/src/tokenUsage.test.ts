import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

/** `font-size: 11px` — a literal length anywhere in the value, var() fallbacks included. */
const RAW_FONT_SIZE = /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/;

describe('packages/ui type tokens', () => {
  it('sizes every glyph from the scale', () => {
    const offenders = cssFiles(SRC)
      .filter((f) => !f.includes('Foundations'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f, i: i + 1, line }))
          .filter(({ line }) => RAW_FONT_SIZE.test(line)),
      )
      .map(({ f, i, line }) => `${f}:${i} ${line.trim()}`);
    expect(offenders).toEqual([]);
  });
});
