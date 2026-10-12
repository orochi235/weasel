import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name: string) => readFileSync(resolve(here, name), 'utf8');
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The sheets the family's module is assembled from, in cascade order. */
function parts(): string[] {
  return [...stripComments(read('Properties.module.css')).matchAll(/@import '\.\/([\w.]+\.css)';/g)].map((m) => m[1]);
}

describe('the property family stylesheet', () => {
  it('is an index of imports and holds no rule of its own', () => {
    const rest = stripComments(read('Properties.module.css')).replace(/@import '\.\/[\w.]+\.css';/g, '');
    expect(rest.trim()).toBe('');
    expect(parts().length).toBeGreaterThan(5);
  });

  it('keeps each hand-written sheet to a few hundred lines', () => {
    for (const name of parts()) {
      if (name.endsWith('.stance.css')) continue;
      expect(read(name).split('\n').length, name).toBeLessThanOrEqual(300);
    }
  });

  // An imported sheet is inlined into the module, so a second import would define its rules twice.
  it('imports each sheet once', () => {
    expect(new Set(parts()).size).toBe(parts().length);
  });
});
