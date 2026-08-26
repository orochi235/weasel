import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));
const SKIP = ['theme/base.less', 'theme/Interstellar.stories.less'];

function lessFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) lessFiles(full, out);
    else if (full.endsWith('.less') && !SKIP.some((s) => full.endsWith(s))) out.push(full);
  }
  return out;
}

const RAW_FONT_SIZE = /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/;
const RAW_RADIUS = /border-radius:[^;}]*\b\d*\.?\d+(px|rem|em)\b/;

function offenders(re: RegExp): string[] {
  return lessFiles(SRC).flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ f, i: i + 1, line }))
      .filter(({ line }) => re.test(line))
      .map(({ i, line }) => `${f}:${i} ${line.trim()}`),
  );
}

describe('labkit type and shape tokens', () => {
  it('sizes every glyph from the scale', () => expect(offenders(RAW_FONT_SIZE)).toEqual([]));
  it('rounds every corner from the scale', () => expect(offenders(RAW_RADIUS)).toEqual([]));
});
