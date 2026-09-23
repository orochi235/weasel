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
    expect(tokenValue('font-size-md')).toBe('13px');
    expect(tokenValue('font-size-lg')).toBe('16px');
    expect(tokenValue('font-size-xl')).toBe('20px');
  });

  // The bare name is the ramp's middle rung, kept because it is what the chrome
  // writes. It has to stay an alias: a literal here would not follow density.
  it('aliases the bare name to the middle rung', () => {
    expect(tokenValue('font-size')).toBe('var(--wzl-font-size-md)');
  });
});

describe('space ladder', () => {
  it('runs in 2px rungs', () => {
    expect(['1', '2', '3', '4', '5', '6', '7', '8'].map((r) => tokenValue(`space-${r}`))).toEqual([
      '2px',
      '4px',
      '6px',
      '8px',
      '10px',
      '12px',
      '14px',
      '16px',
    ]);
  });

  it('keeps the t-shirt names on every other rung', () => {
    expect(tokenValue('space-xs')).toBe('var(--wzl-space-2)');
    expect(tokenValue('space-sm')).toBe('var(--wzl-space-4)');
    expect(tokenValue('space-md')).toBe('var(--wzl-space-6)');
    expect(tokenValue('space-lg')).toBe('var(--wzl-space-8)');
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

/** The body of one `<selector> { … }` block of the generated CSS. */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? '' : css.slice(start, css.indexOf('\n}', start));
}

// A var() inside a custom property is substituted where it is declared, so a
// token built on a mode semantic has to be restated in every mode block.
describe('transparency checker and workspace tokens', () => {
  it('paint from mode semantics, restated per mode', () => {
    for (const sel of [':root', "[data-wzl-mode='dark']", "[data-wzl-mode='light']"]) {
      const body = block(sel);
      expect(body).toMatch(/--wzl-checker-a: var\(--wzl-border\);/);
      expect(body).toMatch(/--wzl-checker-b: var\(--wzl-surface\);/);
      expect(body).toMatch(/--wzl-workspace-surface: var\(--wzl-surface-sunken\);/);
      expect(body).toMatch(/--wzl-workspace-line: var\(--wzl-line-subtle\);/);
    }
  });

  it('sizes the checker tile once', () => {
    expect(tokenValue('checker-size')).toBe('8px');
  });
});
