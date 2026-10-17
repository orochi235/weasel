import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectIconRefs } from '@weasel-js/icons/plugin';
import { icons } from './icons.table';

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [full] : [];
  });
}

// Core writes an annotated literal where it cannot call its own icon(), and nothing typechecks one.
describe('annotated icon literals in core', () => {
  it('each names a glyph in core\'s own table', () => {
    const wrong: string[] = [];
    let seen = 0;
    for (const file of sources(__dirname)) {
      for (const ref of collectIconRefs(readFileSync(file, 'utf8'), file)) {
        seen++;
        const [ns, name] = ref.split(':');
        if (ns !== icons.namespace || !name || !(name in icons.icons)) wrong.push(`${relative(__dirname, file)}: ${ref}`);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
