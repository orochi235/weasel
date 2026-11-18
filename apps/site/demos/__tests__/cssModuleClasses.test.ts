import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIR = join(import.meta.dirname, '..');

/** Each `s.name` a demo reads from its `./X.module.css`, less the classes that stylesheet defines. */
function undefinedClasses(file: string): string[] {
  const src = readFileSync(join(DIR, file), 'utf8');
  const out: string[] = [];
  for (const [, name, css] of src.matchAll(/import (\w+) from '\.\/([\w.]+\.module\.css)'/g)) {
    const sheet = readFileSync(join(DIR, css), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const defined = new Set([...sheet.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
    for (const [, used] of src.matchAll(new RegExp(`\\b${name}\\.([A-Za-z_]\\w*)`, 'g'))) {
      if (!defined.has(used)) out.push(`${css} .${used}`);
    }
  }
  return [...new Set(out)];
}

describe('demo stylesheets', () => {
  it('define every class their demos read', () => {
    const missing = readdirSync(DIR).filter((f) => f.endsWith('.tsx')).flatMap((f) => undefinedClasses(f).map((m) => `${f}: ${m}`));
    expect(missing).toEqual([]);
  });
});
