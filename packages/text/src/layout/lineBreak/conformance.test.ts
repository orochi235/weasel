/**
 * The line breaker against Unicode's own conformance data,
 * `LineBreakTest.txt` (see `__fixtures__/README.md`). A failure here is a real
 * defect, never a disagreement about interpretation.
 */

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { lineBreakOpportunities } from './lineBreaks';

interface Case { line: number; codePoints: number[]; breaks: boolean[] }

/** `× 0041 ÷ 0020 ×` → code points, and a break flag before each position 0..n. */
function parse(text: string): Case[] {
  const cases: Case[] = [];
  for (const [n, raw] of text.split('\n').entries()) {
    const body = raw.split('#')[0].trim();
    if (body === '') continue;
    const codePoints: number[] = [];
    const breaks: boolean[] = [];
    for (const token of body.split(/\s+/)) {
      if (token === '÷') breaks.push(true);
      else if (token === '×') breaks.push(false);
      else codePoints.push(parseInt(token, 16));
    }
    cases.push({ line: n + 1, codePoints, breaks });
  }
  return cases;
}

// Joined by hand: vite rewrites `new URL('./x', import.meta.url)` into an asset reference.
const fixture = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'LineBreakTest.txt.gz');
const cases = parse(gunzipSync(readFileSync(fixture)).toString('utf8'));

describe('LineBreakTest.txt', () => {
  it('parses the whole file', () => {
    expect(cases.length).toBeGreaterThan(16_000);
  });

  it('finds every break opportunity the file expects, and no other', () => {
    const failures: string[] = [];
    for (const c of cases) {
      const got = lineBreakOpportunities(c.codePoints);
      const flags = Array.from(got, (v) => v !== 0);
      if (flags.join() !== c.breaks.join()) {
        const hex = c.codePoints.map((cp) => cp.toString(16).toUpperCase().padStart(4, '0'));
        const show = (b: boolean[]) => b.map((x, i) => `${x ? '÷' : '×'}${hex[i] ? ` ${hex[i]} ` : ''}`).join('');
        failures.push(`line ${c.line}\n  want ${show(c.breaks)}\n  got  ${show(flags)}`);
      }
    }
    const rate = ((cases.length - failures.length) / cases.length) * 100;
    expect(failures.length, `${rate.toFixed(2)}% pass; first 10:\n${failures.slice(0, 10).join('\n')}`).toBe(0);
  });
});
