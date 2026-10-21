import '@weasel-js/theme/tokens.css';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { painted } from '../../testing/paintedContrast';
import { GestureRoute } from '../GestureRoute/GestureRoute';
import { Badge } from './Badge';
import { BASES, type BadgeBase } from './bases';
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
// What the lightest status inks reach on the light surface: info 2.00, warn 2.04, success 2.11.
// An ink computed for a fill that is not there lands near 1.1.
const PLAIN_INK_FLOOR = 1.9;


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

  // A plain badge paints no fill, so in every variant its ink is read against whatever is behind it.
  for (const variant of ['outline', 'solid', 'subtle'] as const) {
    test(`a ${variant} plain badge's ink is legible on the surface behind it`, () => {
      const { container } = render(
        <Surface mode={mode}>
          {STATUSES.map((status) => (
            <p key={status}>
              <Badge shape="plain" status={status} variant="outline" onRemove={() => {}}>label</Badge>{' '}
              <Badge shape="plain" status={status} variant={variant} onRemove={() => {}}>label</Badge>
            </p>
          ))}
        </Surface>,
      );
      const surface = container.querySelector<HTMLElement>('[data-testid="surface"]')!;
      surface.style.background = 'var(--wzl-surface)';
      // The muted inks follow the text color in effect, which a themed page sets.
      surface.style.color = 'var(--wzl-fg)';
      const ground = getComputedStyle(surface).backgroundColor;
      const seen = (css: string): Rgba => [...painted(css, ground), 1];
      const badges = [...container.querySelectorAll<HTMLElement>('[data-status]')];
      for (let i = 0; i < badges.length; i += 2) {
        const [outline, badge] = [badges[i], badges[i + 1]];
        expect(getComputedStyle(badge).backgroundColor, 'paints no fill').toBe('rgba(0, 0, 0, 0)');
        for (const part of ['span', 'button'] as const) {
          const ink = getComputedStyle(badge.querySelector(part)!).color;
          const ratio = contrast(seen(ink), seen(ground));
          expect(ratio, `${badge.dataset.status} ${part}: ${ink} on ${ground}`).toBeGreaterThanOrEqual(PLAIN_INK_FLOOR);
          // The outline ink is the one chosen to be read with no fill under it.
          expect(seen(ink), `${badge.dataset.status} ${part}`).toEqual(seen(getComputedStyle(outline.querySelector(part)!).color));
        }
      }
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

// Pinned against the text itself, not against another badge: a rule meant for a removable badge
// that reaches this one widens both alike, and a comparison between them stays green.
describe('a badge with no remove control and no action', () => {
  const PLAIN_SHAPES: readonly BadgeShape[] = ['pill', 'plain', 'square', 'notched', 'hexagon', 'shield', 'starburst', 'ribbon'];
  for (const shape of PLAIN_SHAPES) {
    for (const size of ['xs', 'sm', 'md'] as const) {
      test(`${shape} ${size}: is as wide as its text, padding, and border, and no wider`, () => {
        const { container } = render(
          <Surface mode="light">
            <p><Badge shape={shape} size={size} status="muted">hidden</Badge></p>
          </Surface>,
        );
        const badge = container.querySelector<HTMLElement>('[data-status]')!;
        const label = [...badge.querySelectorAll('span')].find((el) => el.children.length === 0 && el.textContent === 'hidden')!;
        const range = document.createRange();
        range.selectNodeContents(label.firstChild!);
        const text = range.getBoundingClientRect();
        const box = badge.getBoundingClientRect();
        const inner = label.getBoundingClientRect();
        const cs = getComputedStyle(badge);
        const px = (v: string) => parseFloat(v) || 0;
        const edges = px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth);

        expect(inner.width, 'the label is its text').toBeCloseTo(text.width, 1);
        expect(inner.left).toBeCloseTo(text.left, 1);
        expect(box.width, 'the badge is its text and its edges').toBeCloseTo(text.width + edges, 1);
        expect(inner.left - box.left, 'the label starts after the left edge').toBeCloseTo(px(cs.paddingLeft) + px(cs.borderLeftWidth), 1);
        expect(getComputedStyle(label, '::after').content, 'nothing is added after the label').toBe('none');
      });
    }
  }
});

// Fitting must only ever add: where a base's declared insets already clear the outline, the
// badge is the size those insets make it.
describe('a fitted base with content its declared insets already clear', () => {
  for (const base of ['quatrefoil', 'octant-spline', 'octant-bspline', 'puzzle'] as const) {
    for (const size of ['xs', 'sm', 'md'] as const) {
      test(`${base} ${size}: pads by its declared insets`, async () => {
        const { container } = render(
          <Surface mode="light">
            <p><Badge base={base} size={size} status="muted">ab</Badge></p>
          </Surface>,
        );
        const badge = container.querySelector<HTMLElement>('[data-status]')!;
        await waitFor(() => expect(badge.querySelector('.badge-stroke')).not.toBeNull());
        const declared = BASES[base].insets as { top: number; right: number; bottom: number; left: number };
        for (const side of ['top', 'right', 'bottom', 'left'] as const) {
          expect(badge.style.getPropertyValue(`--badge-inset-${side}`), side).toBe(`${declared[side]}px`);
        }
      });
    }
  }
});

// A base's outline is stretched to the badge's box, so one that dips inward dips further the
// longer the label is. The content has to stay inside it at any length.
describe('a base holds its content inside its outline', () => {
  /** Points along a path, in client px, close enough together that none can step over a corner of the content. */
  const outline = (path: SVGPathElement): DOMPoint[] => {
    const toClient = path.getScreenCTM()!;
    const total = path.getTotalLength();
    const points: DOMPoint[] = [];
    for (let i = 0; i < 4000; i++) points.push(path.getPointAtLength((i / 4000) * total).matrixTransform(toClient));
    return points;
  };

  for (const base of Object.keys(BASES) as BadgeBase[]) {
    for (const label of ['ab', 'a considerably longer label']) {
      for (const removable of [false, true]) {
        test(`${base}, "${label}"${removable ? ', removable' : ''}`, async () => {
          const { container } = render(
            <Surface mode="light">
              <p><Badge base={base} onRemove={removable ? () => {} : undefined}>{label}</Badge></p>
            </Surface>,
          );
          const badge = container.querySelector<HTMLElement>('[data-status]')!;
          const content = badge.lastElementChild!;
          await waitFor(() => {
            const path = badge.querySelector<SVGPathElement>('.badge-stroke');
            if (!path) throw new Error('no outline yet');
            const box = content.getBoundingClientRect();
            const inside = outline(path).filter((p) => p.x > box.left + 0.25 && p.x < box.right - 0.25 && p.y > box.top + 0.25 && p.y < box.bottom - 0.25);
            const worst = Math.max(0, ...inside.map((p) => Math.min(p.x - box.left, box.right - p.x, p.y - box.top, box.bottom - p.y)));
            expect(inside.length, `${inside.length} outline points inside the content, the deepest ${worst.toFixed(1)}px in`).toBe(0);
          });
        });
      }
    }
  }

  // Outward effects: on a base with notches, a point moved outward can cross one and land inside.
  const OUTWARD = {
    scallops: [{ type: 'scallops', params: { scallopRadius: 5, scallopSpacing: 12 } }],
    spikes: [{ type: 'spikes' }],
  } as const;
  for (const base of (Object.keys(BASES) as BadgeBase[]).filter((key) => BASES[key].fitsContent)) {
    for (const [name, effects] of Object.entries(OUTWARD)) {
      test(`${base} under ${name}`, async () => {
        const { container } = render(
          <Surface mode="light">
            <p><Badge base={base} effects={[...effects]}>a considerably longer label</Badge></p>
          </Surface>,
        );
        const badge = container.querySelector<HTMLElement>('[data-status]')!;
        const content = badge.lastElementChild!;
        await waitFor(() => {
          const path = badge.querySelector<SVGPathElement>('.badge-stroke');
          if (!path) throw new Error('no outline yet');
          const box = content.getBoundingClientRect();
          const inside = outline(path).filter((p) => p.x > box.left + 0.25 && p.x < box.right - 0.25 && p.y > box.top + 0.25 && p.y < box.bottom - 0.25);
          expect(inside.length, `${inside.length} outline points inside the content`).toBe(0);
        });
      });
    }
  }
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
          expect(remove.top).toBeGreaterThanOrEqual(box.top - 0.5);
          expect(remove.bottom).toBeLessThanOrEqual(box.bottom + 0.5);
        }
      });
    }
  }

  /** The label's baseline and the top of its capitals, measured apart from the CSS `cap` unit. */
  const capBand = (badge: HTMLElement) => {
    const label = badge.querySelector<HTMLElement>('a, [role="button"]')!;
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0';
    label.appendChild(probe);
    const baseline = probe.getBoundingClientRect().bottom;
    probe.remove();
    const ctx = document.createElement('canvas').getContext('2d')!;
    const cs = getComputedStyle(label);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return { baseline, capTop: baseline - ctx.measureText('H').actualBoundingBoxAscent };
  };

  for (const shape of SHAPES) {
    for (const size of SIZES) {
      test(`${shape} ${size}: centers the remove control on the label's capitals`, () => {
        const { clickable, link } = row(shape, size);
        for (const badge of [clickable, link]) {
          const { baseline, capTop } = capBand(badge);
          for (const el of [badge.querySelector('button')!, badge.querySelector('button > svg')!]) {
            const r = el.getBoundingClientRect();
            expect(Math.abs((r.top + r.bottom) / 2 - (baseline + capTop) / 2), el.tagName).toBeLessThan(0.3);
          }
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

  /** Whole-pixel points one pixel inside each edge of `box`: hit testing is done on whole pixels. */
  const inside = (box: DOMRect) => ({ l: Math.ceil(box.left) + 1, t: Math.ceil(box.top) + 1, r: Math.floor(box.right) - 2, b: Math.floor(box.bottom) - 2 });
  const PADDINGS = [undefined, 10, '4px 14px 6px 12px'] as const;
  for (const shape of ['pill', 'plain', 'square'] as const) {
    for (const padding of PADDINGS) {
      test(`${shape}, padding ${padding ?? 'unset'}: the label takes every edge of the box, the remove control only itself`, () => {
        const { container } = render(
          <Surface mode="light">
            <p>
              <Badge shape={shape} padding={padding} onRemove={() => {}}>label</Badge>{' '}
              <Badge shape={shape} padding={padding} onClick={() => {}} onRemove={() => {}}>label</Badge>{' '}
              <Badge shape={shape} padding={padding} href="#x" onRemove={() => {}}>label</Badge>
            </p>
          </Surface>,
        );
        const [removable, ...actionable] = [...container.querySelectorAll<HTMLElement>('[data-status]')];
        for (const badge of actionable) {
          const target = badge.querySelector('a, [role="button"]')!;
          const removeEl = badge.querySelector('button')!;
          const box = badge.getBoundingClientRect();
          expect([box.width, box.height]).toEqual([removable.getBoundingClientRect().width, removable.getBoundingClientRect().height]);
          const remove = removeEl.getBoundingClientRect();
          const text = textBox(badge, 'label');
          const midX = (text.left + text.right) / 2;
          const midY = (text.top + text.bottom) / 2;
          const removeX = (remove.left + remove.right) / 2;
          const found = (x: number, y: number) => {
            const el = document.elementFromPoint(x, y);
            return el === removeEl || removeEl.contains(el) ? 'remove' : hits(el, target) ? 'label' : hits(el, badge) ? 'badge' : 'outside';
          };
          const { l, t, r, b } = inside(box);
          expect(found(l, midY), 'left edge').toBe('label');
          expect(found(midX, t), 'top edge').toBe('label');
          expect(found(midX, b), 'bottom edge').toBe('label');
          expect(found(Math.floor(remove.left) - 1, midY), 'gap').toBe('label');
          if (box.right - remove.right >= 2) expect(found(r, midY), 'right of the remove control').toBe('label');
          if (remove.top - box.top >= 2) expect(found(removeX, t), 'above the remove control').toBe('label');
          if (box.bottom - remove.bottom >= 2) expect(found(removeX, b), 'below the remove control').toBe('label');
          expect(found(removeX, (remove.top + remove.bottom) / 2), 'remove').toBe('remove');
          for (const [x, y] of [[l - 3, midY], [r + 3, midY], [midX, t - 3], [midX, b + 3]]) {
            expect(found(x, y), `outside at ${x},${y}`).toBe('outside');
          }
        }
      });
    }
  }

  // An absolutely positioned box inside a wrapped inline spans from the first fragment's start to
  // the last one's end, which is not the badge, so pill and plain grow the label's own inline box.
  for (const shape of ['pill', 'plain'] as const) {
    for (const breakStyle of ['slice', 'clone'] as const) {
      for (const padding of [undefined, 10] as const) {
        test(`a wrapped ${shape} (${breakStyle}, padding ${padding ?? 'unset'}) takes clicks on all of every fragment and nowhere else`, () => {
          const { container } = render(
            <Surface mode="light">
              <p style={{ width: 150, lineHeight: '40px' }}>
                xx xx <Badge shape={shape} padding={padding} breakStyle={breakStyle} onRemove={() => {}}>alpha beta gamma delta</Badge>
              </p>
              <p style={{ width: 150, lineHeight: '40px' }}>
                xx xx <Badge shape={shape} padding={padding} breakStyle={breakStyle} onClick={() => {}} onRemove={() => {}}>alpha beta gamma delta</Badge>
              </p>
            </Surface>,
          );
          const [removable, clickable] = [...container.querySelectorAll<HTMLElement>('[data-status]')];
          const target = clickable.querySelector('[role="button"]')!;
          const remove = clickable.querySelector('button')!.getBoundingClientRect();
          const frags = [...clickable.getClientRects()];
          expect(frags.length).toBeGreaterThan(1);
          const want = [...removable.getClientRects()];
          const dy = want[0].top - frags[0].top;
          expect(frags.map((f) => [f.left, f.top + dy, f.width, f.height])).toEqual(want.map((f) => [f.left, f.top, f.width, f.height]));

          const onRemove = (x: number, y: number) => x >= remove.left - 1 && x <= remove.right + 1 && y >= remove.top - 1 && y <= remove.bottom + 1;
          frags.forEach((f, i) => {
            const { l, t, r, b } = inside(f);
            const midY = Math.round((f.top + f.bottom) / 2);
            for (const x of [l, Math.round(f.left + f.width / 3), Math.round(f.left + (2 * f.width) / 3), r]) {
              for (const y of [t, midY, b]) {
                if (onRemove(x, y)) continue;
                expect(hits(document.elementFromPoint(x, y), target), `fragment ${i} at ${x - f.left},${y - f.top} of ${f.width}x${f.height}`).toBe(true);
              }
            }
            for (const [x, y] of [[l - 3, midY], [r + 3, midY], [Math.round(f.left + f.width / 2), t - 3], [Math.round(f.left + f.width / 2), b + 3]]) {
              // Another fragment of the same badge may lie that way; only the page beyond counts.
              if (frags.some((o) => x >= o.left && x <= o.right && y >= o.top && y <= o.bottom)) continue;
              expect(hits(document.elementFromPoint(x, y), clickable), `outside fragment ${i} at ${x - f.left},${y - f.top} of ${f.width}x${f.height}`).toBe(false);
            }
          });
        });
      }
    }
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
