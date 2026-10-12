import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const site = join(import.meta.dirname, '..');

function sources(dir: string, into: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) sources(p, into);
    else if (/\.(css|tsx?)$/.test(p) && !/\.test\.tsx?$/.test(p)) into.push(p);
  }
  return into;
}

describe('the site’s chrome colors', () => {
  // `--ckd-swatch` is a swatch's own color, set per element; every other `--ckd-*` was the fixed dark palette.
  it('come from theme tokens, with no palette of the site’s own', () => {
    const reads = sources(site).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/--ckd-(?!swatch\b)[\w-]+/g)].map((m) => `${relative(site, file)}: ${m[0]}`),
    );
    expect(reads).toEqual([]);
  });

  it('do not pin the page to one color scheme', () => {
    expect(readFileSync(join(site, 'canvas-kit-demo.css'), 'utf8')).not.toMatch(/color-scheme\s*:/);
  });
});
