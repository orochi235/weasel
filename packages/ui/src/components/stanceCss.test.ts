import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STANCE_SLOTS, STANCES } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { CASE, TRACKING } from '../../../../scripts/check-labels';
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
        if (!(name in surface.base) || name === 'tint') continue;
        const fallback = surface.stanced?.[name] ?? surface.base[name];
        expect(text).toContain(`--_s-${name}: var(--wzl-stance-${stance}-${name}, ${fallback});`);
        if (surface.nests) {
          expect(text).toContain(`var(--wzl-stance-${stance}-nested-${name}, var(--wzl-stance-${stance}-${name}, ${fallback}))`);
        }
      }
    }
  });

  it.each(STANCE_SURFACES.filter((s) => s.sinks).map((s) => [s.id, s] as const))('%s sinks its wells without reading them as its own surface', (_, surface) => {
    expect(surface.fills).toBe(true);
    expect(surface.base.surface).not.toContain('--wzl-surface-sunken');
    expect(stanceCss(surface)).toContain('--wzl-surface-sunken: oklch(from var(--_s-fill)');
  });

  // check:labels accepts a title reading --_s-title-case, so the recipe has to
  // arrive through the slot: a stanced panel's title, and every frame and
  // subpanel title, are labels.
  it.each(['panel', 'frame', 'divider'])('%s titles take the params label recipe through their slots', (id) => {
    const surface = STANCE_SURFACES.find((s) => s.id === id)!;
    const look = { ...surface.base, ...surface.stanced };
    expect(look['title-case']).toMatch(CASE);
    expect(look['title-tracking']).toMatch(TRACKING);
  });

  const panel = STANCE_SURFACES.find((s) => s.id === 'panel')!;

  it('names the tint, never a tone', () => {
    for (const surface of STANCE_SURFACES) {
      const text = stanceCss(surface);
      expect(text).not.toMatch(/tone/);
      expect(text).toContain(`${surface.selector} {\n  --wzl-tint: initial;\n}`);
    }
  });

  it('paints a graded surface after its stance, so grade wins the hue and tint wins over both', () => {
    const text = stanceCss(panel);
    const grade = text.indexOf(`.panel[data-grade]`);
    expect(grade).toBeGreaterThan(text.lastIndexOf(`.panel[data-stance=`));
    expect(text).toContain(`.panel[data-grade][data-nested]`);
    expect(text.slice(grade)).toContain('--_s-tint: var(--wzl-tint, var(--wzl-grade));');
    expect(text.slice(grade)).toContain('--_s-border-color: var(--wzl-grade);');
    expect(text.slice(grade)).toContain('--_s-title-color: var(--wzl-grade);');
  });

  it('draws high emphasis in the accent and low emphasis muted', () => {
    const text = stanceCss(panel);
    expect(text).toContain(".panel[data-emphasis='high'] {\n  --_s-border-color: var(--wzl-accent-fg);\n  --_s-title-color: var(--wzl-accent-fg);\n}");
    expect(text).toContain(".panel[data-emphasis='low'] {\n  --_s-title-color: var(--wzl-fg-muted);\n}");
  });

  it('recolors the controls of a tinted or graded surface', () => {
    expect(stanceCss(panel)).toContain('.panel[data-tint],\n.panel[data-grade] {\n  --wzl-accent: var(--_s-accent);');
  });
});
