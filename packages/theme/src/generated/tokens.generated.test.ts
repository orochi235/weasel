import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'tokens.css'), 'utf8');

/** Reads a `--wzl-<name>: <value>;` declaration out of the generated CSS. */
function tokenValue(name: string): string | null {
  const m = css.match(new RegExp(`--wzl-${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe('font-size scale', () => {
  it('covers every rank the chrome uses', () => {
    expect(tokenValue('font-size-2xs')).toBe('9px');
    expect(tokenValue('font-size-xs')).toBe('10px');
    expect(tokenValue('font-size-sm')).toBe('11px');
    expect(tokenValue('font-size')).toBe('13px');
    expect(tokenValue('font-size-lg')).toBe('16px');
    expect(tokenValue('font-size-xl')).toBe('20px');
  });
});

describe('font-weight scale', () => {
  // Oswald's usable range is narrow and its ranks sit low: asking it for the
  // 500/700 a non-condensed face would use paints the whole surface bold.
  it('is the ladder Oswald carries', () => {
    expect(tokenValue('font-weight-light')).toBe('200');
    expect(tokenValue('font-weight-normal')).toBe('300');
    expect(tokenValue('font-weight-medium')).toBe('350');
    expect(tokenValue('font-weight-bold')).toBe('400');
  });
});

describe('line-height and letter-spacing', () => {
  it('has a line-height for each role', () => {
    expect(tokenValue('leading-tight')).toBe('1');
    expect(tokenValue('leading-snug')).toBe('1.2');
    expect(tokenValue('leading')).toBe('1.4');
  });

  it('has a tracking scale for uppercase chrome', () => {
    expect(tokenValue('tracking-none')).toBe('0');
    expect(tokenValue('tracking-wide')).toBe('0.06em');
    expect(tokenValue('tracking-wider')).toBe('0.08em');
  });
});

describe('shape and elevation', () => {
  it('has a pill radius so 999px stops being written by hand', () => {
    expect(tokenValue('radius-pill')).toBe('999px');
  });

  // --wzl-fg is near-white on dark, so an fg-derived shadow lights the field it
  // should darken. Asserted on the color token, which is what could be misauthored.
  it('derives elevation from a shadow color, never from the foreground', () => {
    for (const decl of css.matchAll(/--wzl-shadow:\s*([^;]+);/g)) {
      expect(decl[1]).not.toContain('--wzl-fg');
    }
    expect(css).toContain('--wzl-shadow:');
  });
});
