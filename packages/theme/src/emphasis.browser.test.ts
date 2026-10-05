import './generated/tokens.css';
import { afterEach, describe, expect, test } from 'vitest';

afterEach(() => document.body.replaceChildren());

type Rgba = [number, number, number, number];

/** Chromium serializes a relative color as `color(srgb r g b / a)` in 0–1 and a plain one as `rgb[a](r, g, b[, a])`. */
function parse(css: string): Rgba {
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(css);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(css);
  if (!rgb) throw new Error(`unparsed color ${css}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastOver(fg: Rgba, bg: Rgba): number {
  const a = fg[3];
  const shown: Rgba = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
  const [hi, lo] = [luminance(shown), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A surface in `mode` with text in `text`, holding one span per emphasis step and a muted span nested in a muted one. */
function mount(mode: string, surface: string, text: string) {
  const root = document.createElement('div');
  root.dataset.wzlMode = mode;
  const fill = document.createElement('div');
  fill.style.background = `var(${surface})`;
  fill.style.color = `var(${text})`;
  fill.innerHTML = '<span data-k="muted">m<span data-k="nested">n</span></span><span data-k="subtle">s</span>';
  root.append(fill);
  document.body.append(root);
  const color = (k: string) => parse(getComputedStyle(fill.querySelector(`[data-k="${k}"]`)!).color);
  for (const el of fill.querySelectorAll<HTMLElement>('[data-k="muted"], [data-k="nested"]')) el.style.color = 'var(--wzl-fg-muted)';
  fill.querySelector<HTMLElement>('[data-k="subtle"]')!.style.color = 'var(--wzl-fg-subtle)';
  return {
    text: parse(getComputedStyle(fill).color),
    background: parse(getComputedStyle(fill).backgroundColor),
    muted: color('muted'),
    nested: color('nested'),
    subtle: color('subtle'),
  };
}

const STEPS = { dark: { muted: 0.7, subtle: 0.54 }, light: { muted: 0.78, subtle: 0.64 } } as const;

describe.each(['dark', 'light'] as const)('text emphasis in %s mode', (mode) => {
  test.each([
    ['--wzl-surface', '--wzl-fg'],
    ['--wzl-surface-raised', '--wzl-fg'],
    ['--wzl-surface-sunken', '--wzl-fg'],
    ['--wzl-accent', '--wzl-fg-on-accent'],
  ])('on %s, muted and subtle are the surrounding %s at a lower alpha', (surface, text) => {
    const got = mount(mode, surface, text);
    for (const step of ['muted', 'subtle'] as const) {
      expect(got[step].slice(0, 3)).toEqual(got.text.slice(0, 3).map((c) => expect.closeTo(c, 0)));
      expect(got[step][3]).toBeCloseTo(STEPS[mode][step], 3);
    }
  });

  test('muted text nested in muted text stays one step down', () => {
    const got = mount(mode, '--wzl-surface', '--wzl-fg');
    expect(got.nested).toEqual(got.muted);
  });

  test.each(['--wzl-surface', '--wzl-surface-raised', '--wzl-surface-sunken'])('both steps clear WCAG 4.5:1 on %s', (surface) => {
    const got = mount(mode, surface, '--wzl-fg');
    expect(contrastOver(got.muted, got.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOver(got.subtle, got.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastOver(got.muted, got.background)).toBeGreaterThan(contrastOver(got.subtle, got.background));
  });
});
