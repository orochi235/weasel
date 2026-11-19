import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const SITE = join(__dirname, '..');

/** Each top-level rule's selector and the properties it declares. Rules nested in `@media` are indented, so skipped. */
function topLevelRules(css: string): { selector: string; props: string[] }[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...text.matchAll(/^([^\s@}][^{]*)\{([^}]*)\}/gm)].map(([, selector, body]) => ({
    selector: selector!.trim().replace(/\s+/g, ' '),
    props: [...body!.matchAll(/^\s*([-a-z]+)\s*:/gm)].map((m) => m[1]!),
  }));
}

it('declares no property twice for one selector, where the later rule silently wins', () => {
  const files = readdirSync(SITE).filter((f) => f.endsWith('.css'));
  const repeats: string[] = [];
  for (const file of files) {
    const seen = new Set<string>();
    for (const { selector, props } of topLevelRules(readFileSync(join(SITE, file), 'utf8'))) {
      for (const prop of props) {
        const key = `${selector} { ${prop} }`;
        if (seen.has(key)) repeats.push(`${file}: ${key}`);
        seen.add(key);
      }
    }
  }
  expect(repeats).toEqual([]);
});

/** Every source file under `apps/` that could put a class on an element. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.name === 'node_modules' || d.name === 'dist' || d.name.startsWith('.')) return [];
    const path = join(dir, d.name);
    if (d.isDirectory()) return sources(path);
    return /\.(tsx?|mjs|html)$/.test(d.name) ? [path] : [];
  });
}

it('styles no ckd- class that nothing in apps/ renders', () => {
  const css = readdirSync(SITE).filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(join(SITE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
  const named = new Set([...css.matchAll(/\.(ckd-[a-z0-9-]+)/g)].map((m) => m[1]!));
  const text = sources(join(SITE, '..')).map((f) => readFileSync(f, 'utf8')).join('\n');
  expect([...named].filter((c) => !text.includes(c))).toEqual([]);
});
