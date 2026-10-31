import '@weasel-js/theme/tokens.css';
import '@weasel-js/theme/fonts.css';
import { useState } from 'react';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { ActionsProvider, type Action } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Along, type AlongArc } from '../Along';
import { Slider, type Thumb } from '../Slider';
import { renderWithIcons } from '../../testing/withIcons';
import { icon } from '../../icons.gen';
import { Bar, type BarProps } from './Bar';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const KEYS = ['undo', 'redo', 'flipX', 'flipY', 'front', 'back'] as const;
const NAMES = ['Undo', 'Redo', 'Flip across', 'Flip down', 'Bring to front', 'Send to back'];
const GLYPHS = [icon('core:undo'), icon('core:redo'), icon('core:flipX'), icon('core:flipY'), icon('core:bringToFront'), icon('core:sendToBack')];

let presses: string[] = [];
const ACTIONS: Action[] = KEYS.map((key, i) => ({ id: `lens.${key}`, label: NAMES[i]!, invoker: { timing: 'immediate', run: () => { presses.push(key); } } }));

const SIX: PrefGroup = {
  name: 'Lens',
  children: Object.fromEntries(KEYS.map((key, i) => [key, { kind: 'action', name: NAMES[i]!, description: '', default: undefined, action: `lens.${key}`, icon: GLYPHS[i] } as PrefLeaf])),
};
const FIELD_NAMES = ['Gain', 'Gamma', 'Blur', 'Grain', 'Tint', 'Fade'];
// Groups that open, so each item is a popover trigger.
const FIELDS: PrefGroup = {
  name: 'Lens',
  children: Object.fromEntries(FIELD_NAMES.map((name) => [name.toLowerCase(), { name, as: 'panel', children: { v: { kind: 'number', name: `${name} value`, description: '', default: 1 } as PrefLeaf } } as PrefGroup])),
};
const VALUES = Object.fromEntries(FIELD_NAMES.map((name) => [name.toLowerCase(), 1]));

const TOP: AlongArc = { start: 300, end: 60, inset: 18 };
const BOTTOM: AlongArc = { start: 240, end: 120, direction: 'ccw', inset: 16 };
// 60° of a 102 px radius: about 107 px, too short for the six actions.
const SHORT: AlongArc = { start: 330, end: 30, inset: 18 };
const RADIUS = 102;
const STOPS = [2, 4, 8, 16].map((v) => ({ value: v, label: `${v}×` }));

interface LensProps {
  size?: number;
  top?: number;
  arc?: AlongArc;
  schema?: PrefGroup;
  overflow?: BarProps['overflow'];
  slider?: boolean;
  underlay?: boolean;
  density?: 'compact';
  transform?: string;
}

function Lens({ size = 240, top = 40, arc = TOP, schema = SIX, overflow, slider = false, underlay = false, density, transform }: LensProps) {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 4 }]);
  return (
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <button type="button">Before</button>
      <div data-box data-wzl-density={density} style={{ position: 'relative', width: size, height: size, margin: `${top}px 40px 40px`, transform }}>
        {underlay && <button type="button" style={{ position: 'absolute', inset: 0 }}>Image</button>}
        <Along arc={arc}>
          <Bar label="Lens" schema={schema} values={VALUES} overflow={overflow} />
        </Along>
        {slider && (
          <Along arc={BOTTOM}>
            <Slider min={2} max={16} stops={STOPS} spacing="even" snap="strict" thumbs={thumbs} onInput={setThumbs} />
          </Along>
        )}
      </div>
    </ActionsProvider>
  );
}

const frame = () => new Promise((r) => requestAnimationFrame(r));
const bar = () => screen.getByRole('toolbar', { name: 'Lens' });
const items = () => [...bar().querySelectorAll<HTMLElement>(':scope > [data-bar-item]')];
const more = () => bar().querySelector<HTMLElement>(':scope > [data-bar-more]');

/** Frames until the bar's items stop moving: their lengths are measured after the first paint. */
async function settle() {
  let last = '';
  for (let i = 0; i < 30; i++) {
    await frame();
    const now = [...bar().children].map((el) => el.getAttribute('style')).join('|');
    if (now === last) return;
    last = now;
  }
}

async function mount(props: LensProps = {}) {
  await page.viewport(800, 700);
  const view = renderWithIcons(<Lens {...props} />);
  await document.fonts.ready;
  await settle();
  return { view, box: view.container.querySelector<HTMLElement>('[data-box]')! };
}

beforeEach(() => {
  presses = [];
});
afterEach(async () => {
  await commands.pointer([{ up: true }, { to: [790, 690] }]);
  cleanup();
});

type Pt = { x: number; y: number };
const mid = (el: Element): Pt => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};
const centerOf = (box: HTMLElement): Pt => mid(box);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** Degrees in (-180, 180]. */
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;
/** Where `p` lies around `c`: degrees clockwise from 12 o'clock, in (-180, 180]. */
const bearing = (p: Pt, c: Pt) => (Math.atan2(p.x - c.x, c.y - p.y) * 180) / Math.PI;
/** The point `deg` clockwise from 12 o'clock on the circle of `radius` about `c`. */
const onCircle = (c: Pt, deg: number, radius = RADIUS): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [c.x + radius * Math.sin(rad), c.y - radius * Math.cos(rad)];
};
/** The element's rotation, in degrees, read from its computed transform. */
const angleOf = (el: Element) => {
  const m = new DOMMatrix(getComputedStyle(el).transform);
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
};
const to = (x: number, y: number) => ({ to: [x, y] as [number, number] });
/** A real mouse dragged from `fromDeg` to `toDeg` along the circle, in steps a degree or so apart. */
const dragAlong = async (c: Pt, fromDeg: number, toDeg: number, radius = RADIUS) => {
  const steps = Math.ceil(Math.abs(toDeg - fromDeg));
  const path = Array.from({ length: steps }, (_, i) => to(...onCircle(c, fromDeg + ((toDeg - fromDeg) * (i + 1)) / steps, radius)));
  await commands.pointer([to(...onCircle(c, fromDeg, radius)), { down: true }, ...path, { up: true }]);
};
const pressAt = (p: Pt) => commands.pointer([to(p.x, p.y), { down: true }, { up: true }]);

test("each action's center lies on the top arc, left to right, tipped to it, the middle pair either side of upright", async () => {
  // Compact, the six fit the arc and sit centered on it.
  const { box } = await mount({ slider: true, density: 'compact' });
  const c = centerOf(box);
  const els = items();
  expect(els).toHaveLength(6);
  expect(bar()).not.toHaveAttribute('data-scrolls');
  for (const el of els) {
    expect(Math.abs(dist(mid(el), c) - RADIUS)).toBeLessThanOrEqual(1);
    expect(mid(el).y).toBeLessThan(c.y);
    expect(Math.abs(wrap(angleOf(el) - bearing(mid(el), c)))).toBeLessThanOrEqual(1.5);
  }
  const xs = els.map((el) => mid(el).x);
  for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThan(xs[i - 1]!);
  const [left, right] = [angleOf(els[2]!), angleOf(els[3]!)];
  expect(left).toBeLessThan(0);
  expect(right).toBeGreaterThan(0);
  expect(Math.abs(left + right)).toBeLessThanOrEqual(1);
});

test('on a clockwise bottom arc the run flips and lays from its start at the right, every item upright enough to read', async () => {
  const { box } = await mount({ arc: { start: 120, end: 240, inset: 18 }, density: 'compact' });
  const c = centerOf(box);
  const els = items();
  const xs = els.map((el) => mid(el).x);
  for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeLessThan(xs[i - 1]!);
  for (const el of els) {
    expect(Math.abs(dist(mid(el), c) - RADIUS)).toBeLessThanOrEqual(1);
    expect(mid(el).y).toBeGreaterThan(c.y);
    expect(Math.abs(angleOf(el))).toBeLessThan(90);
    // Flipped: the item's up points at the center, a half turn from the tangent of a clockwise run.
    expect(Math.abs(wrap(angleOf(el) - (bearing(mid(el), c) - 180)))).toBeLessThanOrEqual(1.5);
  }
});

test('a press in the middle of the circle reaches the image, not either control', async () => {
  const { box } = await mount({ slider: true, underlay: true });
  const c = centerOf(box);
  expect(document.elementFromPoint(c.x, c.y)).toBe(screen.getByRole('button', { name: 'Image' }));
});

test("menu mode on a short arc opens the rest from More at the run's end, above the bar", async () => {
  // 330..30: More, last along the run, sits within 30° of 12 o'clock, where outward is up.
  await mount({ arc: SHORT, overflow: 'menu', top: 260 });
  const kept = items();
  expect(kept.length).toBeGreaterThan(0);
  expect(kept.length).toBeLessThan(6);
  const moreAt = mid(more()!);
  for (const el of kept) expect(mid(el).x).toBeLessThan(moreAt.x);
  const trigger = within(more()!).getByRole('button', { name: 'More' });
  await pressAt(mid(trigger));
  const dialog = await screen.findByRole('dialog', { name: 'More' });
  expect(within(dialog).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(NAMES.slice(kept.length));
  expect(dialog.getBoundingClientRect().bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top + 0.5);
});

test('scroll mode: Tab reaches every action, scrolling each past the end into view', async () => {
  const { box } = await mount({ arc: SHORT });
  const c = centerOf(box);
  expect(bar()).toHaveAttribute('data-scrolls');
  expect(items().some((el) => el.getAttribute('data-clipped') === 'past')).toBe(true);
  screen.getByRole('button', { name: 'Before' }).focus();
  for (const name of NAMES) {
    await userEvent.keyboard('{Tab}');
    const focused = document.activeElement as HTMLElement;
    expect(focused.getAttribute('aria-label')).toBe(name);
    const item = focused.closest<HTMLElement>('[data-bar-item]')!;
    await expect.poll(() => item.getAttribute('data-clipped')).toBe('none');
    await settle();
    expect(Math.abs(dist(mid(item), c) - RADIUS)).toBeLessThanOrEqual(1);
  }
});

test('the wheel and a drag along the band scroll; a still press on an action fires it', async () => {
  const { box } = await mount({ arc: SHORT });
  const c = centerOf(box);
  // An item that stays on the run through both scrolls: one past an end is drawn at that end.
  const third = () => bearing(mid(items()[2]!), c);

  // Each item takes a press at its middle; between two of them only the band does.
  const shape = (el: HTMLElement) => {
    const at = mid(el);
    const hit = document.elementFromPoint(at.x, at.y);
    return `${el.getAttribute('data-bar-item')} ${bearing(at, c).toFixed(2)}° ${el.offsetWidth}x${el.offsetHeight} hit ${hit?.tagName}${el.contains(hit) ? ' (own)' : ''}`;
  };
  const layout = items().map(shape).join('\n');
  for (const el of items().filter((one) => one.getAttribute('data-clipped') === 'none')) {
    const at = mid(el);
    expect(el.contains(document.elementFromPoint(at.x, at.y)), layout).toBe(true);
  }
  const gapDeg = Array.from({ length: 201 }, (_, i) => -25 + i / 4).find((deg) => {
    const hit = document.elementFromPoint(...onCircle(c, deg));
    return hit?.parentElement?.parentElement === bar();
  });
  expect(gapDeg, layout).toBeDefined();
  // 25°: on past the run's start, which the drag keeps scrolling through.
  const before = third();
  await dragAlong(c, gapDeg!, gapDeg! - 25);
  await settle();
  expect(Math.abs(third() - before + 25), `gap ${gapDeg}°, third ${before} → ${third()}\n${layout}`).toBeLessThanOrEqual(1);

  const wheels: number[] = [];
  const onWheel = (e: WheelEvent) => wheels.push(e.deltaY);
  document.addEventListener('wheel', onWheel, { capture: true });
  const dragged = third();
  const visible = items().find((el) => el.getAttribute('data-clipped') === 'none')!;
  await commands.pointer([to(mid(visible).x, mid(visible).y), { wheel: [0, 40] }]);
  document.removeEventListener('wheel', onWheel, { capture: true });
  await settle();
  const scrolled = wheels.reduce((a, b) => a + b, 0);
  expect(scrolled).toBeGreaterThan(0);
  expect(Math.abs(third() - dragged + ((scrolled / RADIUS) * 180) / Math.PI)).toBeLessThanOrEqual(1);

  const target = items().find((el) => el.getAttribute('data-clipped') === 'none')!;
  const name = target.querySelector('button')!.getAttribute('aria-label')!;
  await pressAt(mid(target));
  await expect.poll(() => presses).toEqual([KEYS[NAMES.indexOf(name)]]);
});

test('a drag along the run that starts on a popover trigger scrolls it and opens nothing; a still press opens it', async () => {
  const { box } = await mount({ arc: SHORT, schema: FIELDS });
  const c = centerOf(box);
  const gain = screen.getByRole('button', { name: 'Gain' });
  const from = bearing(mid(gain), c);
  await dragAlong(c, from, from - 15);
  // react-aria clicks a trigger itself 80 ms after a release that raised no click.
  await new Promise((r) => setTimeout(r, 150));
  expect(screen.queryByRole('dialog')).toBeNull();
  await settle();
  expect(Math.abs(bearing(mid(gain), c) - from + 15)).toBeLessThanOrEqual(1);

  // The fields are wide enough that none lies wholly within the run now: press one whose middle does.
  const target = items().find((el) => el.getAttribute('data-clipped') !== 'past' && Math.abs(bearing(mid(el), c)) < 25)!;
  const trigger = within(target).getByRole('button');
  await pressAt(mid(trigger));
  expect(await screen.findByRole('dialog', { name: trigger.textContent! })).toBeTruthy();
});

test('an overflowing run takes touch for itself; a menu-mode run leaves it to the page', async () => {
  await mount({ arc: SHORT });
  expect(getComputedStyle(items()[0]!).touchAction).toBe('none');
  expect(getComputedStyle(bar().querySelector('svg path')!).touchAction).toBe('none');
  cleanup();
  await mount({ arc: SHORT, overflow: 'menu' });
  expect(getComputedStyle(items()[0]!).touchAction).not.toBe('none');
});

test('resizing the box moves the actions onto the new rim', async () => {
  const { box } = await mount({ slider: true });
  box.style.width = '320px';
  box.style.height = '320px';
  await expect
    .poll(() => Math.max(...items().map((el) => Math.abs(dist(mid(el), centerOf(box)) - 142))))
    .toBeLessThanOrEqual(1);
});

for (const [name, transform, turn, scale] of [
  ['scaled', 'scale(0.75)', 0, 0.75],
  ['rotated', 'rotate(90deg)', 90, 1],
  ['rotated and scaled', 'rotate(-35deg) scale(1.25)', -35, 1.25],
] as const) {
  test(`under a ${name} ancestor the items sit on the rim and a drag along the band scrolls as far as it went`, async () => {
    const { box } = await mount({ arc: SHORT, transform });
    const c = centerOf(box);
    const radius = RADIUS * scale;
    const third = () => wrap(bearing(mid(items()[2]!), c) - turn);
    expect(Math.abs(dist(mid(items()[2]!), c) - radius)).toBeLessThanOrEqual(1);
    const gapDeg = Array.from({ length: 201 }, (_, i) => -25 + i / 4).find((deg) => {
      const hit = document.elementFromPoint(...onCircle(c, deg + turn, radius));
      return hit?.parentElement?.parentElement === bar();
    });
    expect(gapDeg).toBeDefined();
    const before = third();
    await dragAlong(c, gapDeg! + turn, gapDeg! + turn - 25, radius);
    await settle();
    expect(Math.abs(third() - before + 25), `third ${before} → ${third()}`).toBeLessThanOrEqual(1);
  });
}
