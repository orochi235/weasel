import '@weasel-js/theme/tokens.css';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { GestureRoute } from '../GestureRoute/GestureRoute';
import { Badge } from './Badge';
import type { BadgeStatus } from './types';

// Badge colors come from tokens that follow currentColor and from color-mix,
// neither of which jsdom resolves, so legibility is only checkable here.

afterEach(cleanup);

type Rgba = [number, number, number, number];

/** Chromium serializes a relative color as `color(srgb r g b / a)` in 0–1 or, from `oklch(from …)`,
 *  as `oklch(l c h / a)`; a plain one as `rgb[a](r, g, b[, a])`. Only a gray oklch is converted. */
function parse(css: string): Rgba {
  const lch = /^oklch\(([\d.e-]+) ([\d.e-]+) [\d.e-]+(?: \/ ([\d.e-]+))?\)$/.exec(css);
  if (lch) {
    if (Number(lch[2]) !== 0) throw new Error(`chromatic oklch ${css}`);
    const lin = Number(lch[1]) ** 3;
    const c = 255 * (lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055);
    return [c, c, c, lch[3] === undefined ? 1 : Number(lch[3])];
  }
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.e-]+))?\)$/.exec(css);
  if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, srgb[4] === undefined ? 1 : Number(srgb[4])];
  const rgb = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(css);
  if (!rgb) throw new Error(`unparsed color ${css}`);
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), rgb[4] === undefined ? 1 : Number(rgb[4])];
}

function over(fg: Rgba, bg: Rgba): Rgba {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** A themed surface in `mode`, the way the kit sets it: only `[data-wzl-mode]` switches the tokens. */
function Surface({ mode, children }: { mode: 'light' | 'dark'; children: React.ReactNode }) {
  return (
    <div data-wzl-mode={mode} data-testid="surface">
      {children}
    </div>
  );
}

/** The painted fill under a badge's text, composited onto the surface, and the text over it. */
async function paint(root: HTMLElement, badge: HTMLElement) {
  const surface = root.querySelector<HTMLElement>('[data-testid="surface"]')!;
  surface.style.background = 'var(--wzl-surface)';
  surface.style.color = 'var(--wzl-fg)';
  const painted = badge.dataset.shape === 'pill'
    ? badge
    : await waitFor(() => {
      const p = badge.querySelector('.badge-fill');
      if (!p) throw new Error('no fill path yet');
      return p;
    });
  const bg = parse(getComputedStyle(surface).backgroundColor);
  const fill = over(parse(painted === badge ? getComputedStyle(badge).backgroundColor : getComputedStyle(painted).fill), bg);
  const text = over(parse(getComputedStyle(badge.lastElementChild as HTMLElement).color), fill);
  return { bg, fill, text };
}

const STATUSES: readonly BadgeStatus[] = ['accent', 'info', 'success', 'warn', 'danger', 'muted', 'neutral'];


describe.each(['light', 'dark'] as const)('%s mode', (mode) => {
  test('a gesture route\'s modifier chord is legible on its fill', async () => {
    const { container } = render(
      <Surface mode={mode}>
        <GestureRoute route="[*:*] drag => anchor +shift" />
      </Surface>,
    );
    const chord = [...container.querySelectorAll<HTMLElement>('[data-variant="solid"]')].find((el) => el.textContent?.includes('⇧'))!;
    const { bg, fill, text } = await paint(container, chord);
    expect(contrast(text, fill), `text ${text.map(Math.round)} on fill ${fill.map(Math.round)}`).toBeGreaterThanOrEqual(3);
    expect(contrast(fill, bg)).toBeGreaterThan(1.5);
  });

  test('a solid muted pill\'s text is legible on its fill', async () => {
    const { container } = render(
      <Surface mode={mode}>
        <Badge shape="pill" status="muted" variant="solid">
          label
        </Badge>
      </Surface>,
    );
    const { text, fill } = await paint(container, container.querySelector<HTMLElement>('[data-status]')!);
    expect(contrast(text, fill), `text ${text.map(Math.round)} on fill ${fill.map(Math.round)}`).toBeGreaterThanOrEqual(3);
  });

  for (const status of STATUSES) {
    test(`a solid ${status} badge's text is legible on its fill`, async () => {
      const { container } = render(
        <Surface mode={mode}>
          <Badge base="powerline" status={status} variant="solid">
            label
          </Badge>
        </Surface>,
      );
      const { text, fill } = await paint(container, container.querySelector<HTMLElement>('[data-status]')!);
      expect(contrast(text, fill), `text ${text.map(Math.round)} on fill ${fill.map(Math.round)}`).toBeGreaterThanOrEqual(3);
    });
  }
});
