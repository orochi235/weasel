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
