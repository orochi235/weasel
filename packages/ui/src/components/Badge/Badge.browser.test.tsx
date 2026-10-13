import '@weasel-js/theme/tokens.css';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { painted } from '../../testing/paintedContrast';
import { GestureRoute } from '../GestureRoute/GestureRoute';
import { Badge } from './Badge';
import type { BadgeShape, BadgeSize, BadgeStatus } from './types';

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

  test('a hovered button badge lightens its edge instead of losing it', async () => {
    const { container } = render(
      <Surface mode={mode}>
        <Badge shape="pill" status="danger" variant="outline" onClick={() => {}}>
          label
        </Badge>
      </Surface>,
    );
    const badge = container.querySelector<HTMLElement>('[data-status]')!;
    // The mix serializes as oklab(), so a canvas reads the channels.
    const edge = (): Rgba => [...painted(getComputedStyle(badge).borderTopColor, '#000'), 1];
    const rest = edge();
    await userEvent.hover(badge);
    const hovered = edge();
    expect(luminance(hovered)).toBeGreaterThan(luminance(rest));
    expect(hovered[0] - hovered[2], 'still a red').toBeGreaterThan(80);
  });
});

// A composed badge has no CSS box to outline: its silhouette is an SVG path, and a root button
// or link drops the browser's own outline.
describe('a composed badge under keyboard focus', () => {
  /** Everything that could show focus: the root's outline and whatever the outline SVG draws. */
  const look = (badge: HTMLElement) => {
    const cs = getComputedStyle(badge);
    return [cs.outlineStyle, cs.outlineWidth, cs.boxShadow, badge.querySelector('svg')!.innerHTML].join('|');
  };
  const cases = {
    'a base': <Badge base="rounded-rect" status="info" onClick={() => {}}>label</Badge>,
    'a base and effects': <Badge base="chamfered-rect" effects={[{ type: 'spikes' }]} status="info" onClick={() => {}}>label</Badge>,
    'a shape that composes': <Badge shape="hexagon" status="info" onClick={() => {}}>label</Badge>,
    'a base and a remove control': <Badge base="rounded-rect" status="info" onClick={() => {}} onRemove={() => {}}>label</Badge>,
  };

  for (const [name, badgeEl] of Object.entries(cases)) {
    test(`${name}: rings the composed silhouette`, async () => {
      const { container } = render(<Surface mode="light"><p>{badgeEl}</p></Surface>);
      const badge = container.querySelector<HTMLElement>('[data-status]')!;
      expect(badge.dataset.shape).toBe('compose');
      await waitFor(() => expect(badge.querySelector('.badge-stroke')).not.toBeNull());
      const rest = look(badge);
      await userEvent.tab();
      expect(badge.contains(document.activeElement)).toBe(true);
      await waitFor(() => expect(look(badge), 'nothing changed on focus').not.toBe(rest));

      const ring = badge.querySelector<SVGPathElement>('.badge-focus')!;
      const ringStyle = getComputedStyle(ring);
      expect(ringStyle.stroke).not.toBe('none');
      expect(Number(ringStyle.opacity)).toBeGreaterThan(0);
      const outer = ring.getBoundingClientRect();
      const body = badge.querySelector('.badge-stroke')!.getBoundingClientRect();
      for (const gap of [body.left - outer.left, body.top - outer.top, outer.right - body.right, outer.bottom - body.bottom]) {
        expect(gap).toBeGreaterThan(1);
        expect(gap).toBeLessThan(4);
      }

      if (badge.querySelector('button')) {
        await userEvent.tab();
        expect(document.activeElement).toBe(badge.querySelector('button'));
        await waitFor(() => expect(badge.querySelector('.badge-focus')).toBeNull());
      }
    });
  }
});

// The remove button cannot sit inside a root button or link, so a removable badge with an
// action moves the action onto its label. The box has to come out the same as any other badge's.
describe('a removable badge with an action', () => {
  const textBox = (badge: HTMLElement, text: string): DOMRect => {
    const walker = document.createTreeWalker(badge, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent !== text) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      return range.getBoundingClientRect();
    }
    throw new Error(`no text ${text}`);
  };
  const row = (shape: BadgeShape, size: BadgeSize) => {
    const { container } = render(
      <Surface mode="light">
        <p>
          <Badge shape={shape} size={size} status="info">label</Badge>{' '}
          <Badge shape={shape} size={size} status="info" onRemove={() => {}}>label</Badge>{' '}
          <Badge shape={shape} size={size} status="info" onClick={() => {}} onRemove={() => {}}>label</Badge>{' '}
          <Badge shape={shape} size={size} status="info" href="#x" onRemove={() => {}}>label</Badge>
        </p>
      </Surface>,
    );
    const [plain, removable, clickable, link] = [...container.querySelectorAll<HTMLElement>('[data-status]')];
    return { plain, removable, clickable, link };
  };

  const SHAPES: readonly BadgeShape[] = ['pill', 'square', 'notched', 'plain'];
  const SIZES: readonly BadgeSize[] = ['xs', 'sm', 'md'];

  for (const shape of SHAPES) {
    for (const size of SIZES) {
      test(`${shape} ${size}: sits on the baseline and at the height of a plain badge`, () => {
        const { plain, removable, clickable, link } = row(shape, size);
        const want = plain.getBoundingClientRect();
        const wantText = textBox(plain, 'label');
        for (const badge of [clickable, link]) {
          const got = badge.getBoundingClientRect();
          expect(got.height).toBeCloseTo(want.height, 1);
          expect(got.top).toBeCloseTo(want.top, 1);
          const text = textBox(badge, 'label');
          expect(text.top).toBeCloseTo(wantText.top, 1);
          expect(text.bottom).toBeCloseTo(wantText.bottom, 1);
          // The same content as a badge that is only removable, so the same width.
          expect(got.width).toBeCloseTo(removable.getBoundingClientRect().width, 1);
        }
      });

      test(`${shape} ${size}: holds the remove control inside its box`, () => {
        const { clickable, link } = row(shape, size);
        for (const badge of [clickable, link]) {
          const box = badge.getBoundingClientRect();
          const remove = badge.querySelector('button')!.getBoundingClientRect();
          expect(remove.width).toBeGreaterThan(0);
          expect(remove.left).toBeGreaterThanOrEqual(box.left);
          expect(remove.right).toBeLessThanOrEqual(box.right);
          // A plain badge is a bare run of text with no box to hold anything vertically.
          if (shape === 'plain') continue;
          expect(remove.top).toBeGreaterThanOrEqual(box.top - 0.5);
          expect(remove.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
        }
      });
    }
  }

  const HIT_SHAPES: readonly BadgeShape[] = [...SHAPES, 'hexagon', 'shield'];
  const hits = (el: Element | null, target: Element) => el !== null && target.contains(el);

  for (const shape of HIT_SHAPES) {
    for (const size of SIZES) {
      test(`${shape} ${size}: the label takes the padding and the gap, the remove control only itself`, () => {
        const { clickable, link } = row(shape, size);
        for (const badge of [clickable, link]) {
          const target = badge.querySelector('a, [role="button"]')!;
          const removeEl = badge.querySelector('button')!;
          const box = badge.getBoundingClientRect();
          const text = textBox(badge, 'label');
          const remove = removeEl.getBoundingClientRect();
          const midY = (text.top + text.bottom) / 2;
          if (text.left - box.left >= 1) {
            expect(hits(document.elementFromPoint((box.left + text.left) / 2, midY), target), 'left padding').toBe(true);
          }
          if (text.top - box.top >= 1) {
            expect(hits(document.elementFromPoint((text.left + text.right) / 2, (box.top + text.top) / 2), target), 'top padding').toBe(true);
          }
          expect(hits(document.elementFromPoint(remove.left - 1, (remove.top + remove.bottom) / 2), target), 'gap').toBe(true);
          expect(hits(document.elementFromPoint((remove.left + remove.right) / 2, (remove.top + remove.bottom) / 2), removeEl), 'remove').toBe(true);
        }
      });
    }
  }

  for (const shape of ['pill', 'square', 'notched'] as const) {
    test(`${shape}: a click in the padding acts and does not remove`, async () => {
      const calls: string[] = [];
      const { container } = render(
        <Surface mode="light">
          <p>
            <Badge shape={shape} onClick={() => calls.push('click')} onRemove={() => calls.push('remove')}>label</Badge>{' '}
            <Badge shape={shape} href="#x" onClick={() => calls.push('follow')} onRemove={() => calls.push('remove')}>label</Badge>
          </p>
        </Surface>,
      );
      for (const badge of container.querySelectorAll<HTMLElement>('[data-status]')) {
        await userEvent.click(badge, { position: { x: 1.5, y: badge.getBoundingClientRect().height / 2 } });
      }
      expect(calls).toEqual(['click', 'follow']);
    });
  }

  // An absolutely positioned box inside a wrapped inline spans from the first fragment's start to
  // the last one's end, which is not the badge, so pill and plain grow the label's own inline box.
  for (const breakStyle of ['slice', 'clone'] as const) {
    test(`a wrapped pill (${breakStyle}) takes clicks on its fragments and nowhere else`, () => {
      const { container } = render(
        <Surface mode="light">
          <p style={{ width: 130 }}>
            xx xx <Badge breakStyle={breakStyle} onRemove={() => {}}>alpha beta gamma delta</Badge>
          </p>
          <p style={{ width: 130 }}>
            xx xx <Badge breakStyle={breakStyle} onClick={() => {}} onRemove={() => {}}>alpha beta gamma delta</Badge>
          </p>
        </Surface>,
      );
      const [removable, clickable] = [...container.querySelectorAll<HTMLElement>('[data-status]')];
      const target = clickable.querySelector('[role="button"]')!;
      const frags = [...clickable.getClientRects()];
      expect(frags.length).toBeGreaterThan(1);
      // The label's padding must not move anything.
      const want = [...removable.getClientRects()];
      const top = want[0].top - frags[0].top;
      expect(frags.map((f) => [f.left, f.top + top, f.width, f.height])).toEqual(want.map((f) => [f.left, f.top, f.width, f.height]));

      const [first, second] = frags;
      const midY = (f: DOMRect) => (f.top + f.bottom) / 2;
      expect(hits(document.elementFromPoint(first.left + 2, midY(first)), target), 'first fragment, left padding').toBe(true);
      expect(hits(document.elementFromPoint(first.left + 20, first.top + 1.5), target), 'first fragment, top padding').toBe(true);
      expect(hits(document.elementFromPoint(second.left + 20, second.top + 1.5), target), 'second fragment, top padding').toBe(true);
      if (breakStyle === 'clone') {
        expect(hits(document.elementFromPoint(second.left + 2, midY(second)), target), 'second fragment, left padding').toBe(true);
      }
      // Left of the first fragment, on its line: inside the badge's bounding box, outside the badge.
      expect(first.left).toBeGreaterThan(second.left + 4);
      expect(hits(document.elementFromPoint(second.left + 2, midY(first)), clickable), 'beside the first fragment').toBe(false);
      const last = frags[frags.length - 1];
      expect(hits(document.elementFromPoint(last.right + 4, midY(last)), clickable), 'after the last fragment').toBe(false);
    });
  }

  test('a linked label keeps the badge\'s ink and takes no underline', () => {
    const { plain, link } = row('pill', 'sm');
    const anchor = link.querySelector('a')!;
    expect(getComputedStyle(anchor).color).toBe(getComputedStyle(plain.lastElementChild!).color);
    expect(getComputedStyle(anchor).textDecorationLine).toBe('none');
    expect(getComputedStyle(anchor).cursor).toBe('pointer');
  });

  test('focusing the label rings the badge, and the label draws no ring of its own', async () => {
    const { clickable } = row('pill', 'sm');
    const target = clickable.querySelector<HTMLElement>('[role="button"]')!;
    target.focus();
    await waitFor(() => expect(getComputedStyle(clickable).outlineStyle).toBe('solid'));
    expect(getComputedStyle(target).outlineStyle).toBe('none');
  });

  test('Enter on the label acts, and the remove control is the next tab stop', async () => {
    let clicks = 0;
    let removes = 0;
    const { container } = render(
      <Surface mode="light">
        <Badge onClick={() => { clicks++; }} onRemove={() => { removes++; }}>label</Badge>
      </Surface>,
    );
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect([clicks, removes]).toEqual([2, 0]);
    await userEvent.tab();
    expect(document.activeElement).toBe(container.querySelector('button'));
    await userEvent.keyboard('{Enter}');
    expect([clicks, removes]).toEqual([2, 1]);
  });
});
