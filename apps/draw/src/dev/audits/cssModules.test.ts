import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const dir = import.meta.dirname;
const sources = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));

/** Each local name a component imports a CSS module as, and the classes it reads off it. */
function usesOf(source: string): { sheet: string; used: string[] }[] {
  const imports = [...source.matchAll(/^import (\w+) from '\.\/([\w.]+\.module\.css)';$/gm)];
  return imports.map(([, name, sheet]) => ({
    sheet: sheet!,
    used: [...new Set([...source.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g'))].map((m) => m[1]!))],
  }));
}

describe("the audit page's stylesheets", () => {
  it.each(sources)('define every class %s reads off them', (file) => {
    for (const { sheet, used } of usesOf(readFileSync(join(dir, file), 'utf8'))) {
      const defined = new Set([...readFileSync(join(dir, sheet), 'utf8').matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]!));
      expect(used.filter((c) => !defined.has(c)), `${file} → ${sheet}`).toEqual([]);
    }
  });
});
