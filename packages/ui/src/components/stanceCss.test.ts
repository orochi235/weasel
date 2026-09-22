import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STANCE_SLOTS, STANCES } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { stanceCss, withStanceCss } from './stanceCss';
import { STANCE_SURFACES } from './stanceSurfaces';

const root = resolve(__dirname, '../../../..');

describe('stance rules', () => {
  it.each(STANCE_SURFACES.map((s) => [s.id, s] as const))('%s carries its region as `npm run gen:stances` writes it', (_, surface) => {
    const css = readFileSync(resolve(root, surface.file), 'utf8');
    expect(withStanceCss(css, surface)).toBe(css);
  });

  // jsdom resolves no var(), so this reads the chains as text — a proxy; the
  // browser spec is what proves the looks.
  it.each(STANCE_SURFACES.map((s) => [s.id, s] as const))('%s falls every stance slot back to its own look', (_, surface) => {
    const text = stanceCss(surface);
    for (const stance of surface.stanceless ? [] : STANCES) {
      for (const { name } of STANCE_SLOTS) {
        if (!(name in surface.base) || name === 'tone') continue;
        const fallback = surface.stanced?.[name] ?? surface.base[name];
        expect(text).toContain(`--_s-${name}: var(--wzl-stance-${stance}-${name}, ${fallback});`);
        if (surface.nests) {
          expect(text).toContain(`var(--wzl-stance-${stance}-nested-${name}, var(--wzl-stance-${stance}-${name}, ${fallback}))`);
        }
      }
    }
  });
});
