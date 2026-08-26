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
  it('is one ladder of three ranks', () => {
    expect(tokenValue('font-weight-normal')).toBe('300');
    expect(tokenValue('font-weight-medium')).toBe('500');
    expect(tokenValue('font-weight-bold')).toBe('700');
  });

  it('drops the light rank, which nothing distinguishes from normal', () => {
    expect(tokenValue('font-weight-light')).toBeNull();
  });
});

describe('line-height and letter-spacing', () => {
  it('has a line-height for each role', () => {
    expect(tokenValue('line-height-tight')).toBe('1');
    expect(tokenValue('line-height-snug')).toBe('1.2');
    expect(tokenValue('line-height')).toBe('1.4');
  });

  it('has a tracking scale for uppercase chrome', () => {
    expect(tokenValue('tracking-none')).toBe('0');
    expect(tokenValue('tracking-wide')).toBe('0.06em');
    expect(tokenValue('tracking-wider')).toBe('0.08em');
  });
});
