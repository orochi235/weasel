import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOKEN_MANIFEST } from '@weasel-js/theme';
import { BUTTON_LAB_DEFAULTS as D, buttonVarsOf, exportDeltas, type ButtonLabConfig } from './buttonLabConfig';

const css = readFileSync(resolve(__dirname, '../Button.module.css'), 'utf8');
/** Each literal `--btn-*` value the stylesheet's `.button` rule ships. */
const shipped = new Map(
  [...css.slice(0, css.indexOf('}')).matchAll(/(--btn-[a-z-]+):\s*([^;]+);/g)]
    .filter(([, , v]) => !v!.includes('var('))
    .map(([, k, v]) => [k!, v!.trim()]),
);
const token = (name: string) => TOKEN_MANIFEST.find((t) => t.name === name)!.defaultValue;
const tuned = (patch: (c: ButtonLabConfig) => void): ButtonLabConfig => {
  const c = structuredClone(D);
  patch(c);
  return c;
};

describe('button lab export', () => {
  it('starts every glass knob at the value Button.module.css ships', () => {
    const vars = buttonVarsOf(D);
    expect(shipped.size).toBeGreaterThan(15);
    for (const [k, v] of shipped) expect([k, parseFloat(vars[k]!)]).toEqual([k, parseFloat(v)]);
  });

  it('starts the shape at the default theme button', () => {
    expect(`${D.shape.height}px`).toBe(token('--wzl-control-h'));
    expect(`${D.shape.padx}px`).toBe(token('--wzl-space-6'));
    expect(`${D.shape.fontsize}px`).toBe(token('--wzl-font-size'));
    expect(D.shape.fontweight).toBe(token('--wzl-font-weight-medium'));
    expect(buttonVarsOf(D)['--wzl-button-radius']).toBe(`calc(var(--btn-height) * ${D.shape.radius / 100})`);
  });

  it('exports nothing for an untouched lab', () => {
    expect(exportDeltas(D)).toMatch(/No deltas/);
  });

  it('exports a shape as the md size it was tuned at, behind the theme hooks, and leaves the theme accent alone', () => {
    const out = exportDeltas(tuned((c) => {
      c.target = 'button'; c.shape.height = 40; c.shape.fontsize = 16; c.shape.radius = 20; c.accent = '#ff0000';
    }));
    expect(out).toBe([
      '.button {',
      '  --btn-radius: var(--wzl-button-radius, calc(var(--btn-height) * 0.2));',
      '}',
      '.size_md {',
      '  --btn-fontsize: 16px;',
      '  --btn-height: var(--wzl-button-h, 40px);',
      '}',
    ].join('\n'));
    expect(out).not.toMatch(/^\s*--wzl-/m);
  });

  it('exports no inset x offset for an angle whose sine rounds to zero', () => {
    const out = exportDeltas(tuned((c) => { c.depth.textInsetAngle = 360; }));
    expect(out).not.toMatch(/inset-x/);
    expect(out).toBe(exportDeltas(tuned((c) => { c.depth.textInsetAngle = 0; })));
  });
});
