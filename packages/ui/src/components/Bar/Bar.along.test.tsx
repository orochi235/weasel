import { afterAll, afterEach, beforeAll, describe, expect, onTestFinished, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { arcShape, lineShape, runPlaces, runStationAt, trackRun, type TrackShape } from '@weasel-js/geom';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Along, arcInBox } from '../Along';
import { isApplePlatform } from '@weasel-js/gestures';
import { Bar } from './Bar';
import alongStyles from '../Along/Along.module.css';

// jsdom lays nothing out: an Along is 200 by 200 untransformed and every other element 40 wide; every box is 200 by
// 200 at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = ['offsetWidth', 'offsetHeight'].map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)!] as const);
const isAlong = (el: HTMLElement) => el.classList.contains(alongStyles.along!);
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 40; } });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return isAlong(this) ? 200 : 0; } });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  for (const [k, d] of realOffset) Object.defineProperty(HTMLElement.prototype, k, d);
});
afterEach(cleanup);

const action = (name: string): PrefLeaf => ({ kind: 'action', name, description: '', default: undefined, action: `edit.${name}` }) as PrefLeaf;
const actions = (...names: string[]): PrefGroup => ({ name: 'Tools', children: Object.fromEntries(names.map((n) => [n, action(n)])) });
const six = actions('a', 'b', 'c', 'd', 'e', 'f');

const placed = (el: Element) => {
  const style = (el as HTMLElement).style;
  return { x: Number.parseFloat(style.getPropertyValue('--at-x')), y: Number.parseFloat(style.getPropertyValue('--at-y')), angle: Number.parseFloat(style.getPropertyValue('--at-angle')) };
};
const items = (): Element[] => Array.from(screen.getByRole('toolbar').querySelectorAll(':scope > [data-bar-item]'));
const more = (): Element => screen.getByRole('toolbar').querySelector(':scope > [data-bar-more]')!;

function expectAt(el: Element, shape: TrackShape, g: number) {
  const want = trackRun(shape).at(g);
  const got = placed(el);
  expect(got.x).toBeCloseTo(want.point.x);
  expect(got.y).toBeCloseTo(want.point.y);
  expect(got.angle).toBeCloseTo(want.angle);
}

describe('Bar along a curve', () => {
  test('on a shape a field sits on the run, as on a straight bar', () => {
    const schema: PrefGroup = { name: 'Tools', children: { width: { kind: 'number', name: 'Width', description: '', default: 4 }, undo: action('Undo') } };
    render(<Bar schema={schema} values={{ width: 4 }} shape={arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 })} label="Tools" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-shape', 'arc');
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Width' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  test('a separator on the line stands across the run', () => {
    const rule: PrefLeaf = { kind: 'separator', name: '', description: '', default: undefined } as PrefLeaf;
    const schema: PrefGroup = { name: 'Tools', children: { a: action('a'), rule, b: action('b') } };
    render(<Bar schema={schema} shape={arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 })} label="Tools" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  test("a lone item sits at the run's middle, tipped", () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 0, end: 90 });
    render(<Bar schema={actions('Undo')} shape={shape} label="Tools" />);
    expect(trackRun(shape).at(0.5).angle).toBeCloseTo(45);
    expectAt(items()[0]!, shape, 0.5);
  });

  test('a straight bar on a line shape keeps its flex line', () => {
    render(
      <Along>
        <Bar schema={actions('Undo', 'Redo')} shape={lineShape({ x: 0, y: 0 }, { x: 200, y: 0 })} label="Tools" />
      </Along>,
    );
    const bar = screen.getByRole('toolbar');
    expect(bar).not.toHaveAttribute('data-shape');
    expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
    expect(bar.querySelector('[style*="--at-x"]')).toBeNull();
  });

  test('menu mode keeps what fits along the arc, give or take RUN_SLACK, and puts More last along the run', () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
    expect(shape.length).toBeCloseTo(157.08, 2);
    render(<Bar schema={six} shape={shape} overflow="menu" label="Tools" />);
    const kept = items();
    // Three items and More take 160, under 3 over the arc.
    expect(kept.map((el) => el.getAttribute('data-bar-item'))).toEqual(['a', 'b', 'c']);
    const xs = kept.map((el) => placed(el).x);
    expect(placed(more()).x).toBeGreaterThan(Math.max(...xs));
    expect(xs[0]!).toBeLessThan(xs[1]!);
    fireEvent.click(within(more() as HTMLElement).getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('dialog', { name: 'More' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['d', 'e', 'f']);
  });

  test('right to left, menu mode starts the run at its right end and puts More at its left', () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
    render(<div dir="rtl"><Bar schema={six} shape={shape} overflow="menu" label="Tools" /></div>);
    const xs = items().map((el) => placed(el).x);
    expect(xs[0]!).toBeGreaterThan(xs[1]!);
    expect(placed(more()).x).toBeLessThan(Math.min(...xs));
    expect(placed(items()[0]!).angle).toBeGreaterThan(0);
  });

  test("an arc too short for any item keeps the More button alone at the run's center, holding every item", () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 10, start: 315, end: 45 });
    render(<Bar schema={six} shape={shape} overflow="menu" label="Tools" />);
    expect(items()).toEqual([]);
    expectAt(more(), shape, 0.5);
    fireEvent.click(within(more() as HTMLElement).getByRole('button', { name: 'More' }));
    expect(within(screen.getByRole('dialog', { name: 'More' })).getAllByRole('button')).toHaveLength(6);
  });

  test('a Bar inside Along follows its arc and its align', () => {
    render(
      <Along arc={{ start: 270, end: 90 }} align="start">
        <Bar schema={actions('Undo', 'Redo')} label="Tools" />
      </Along>,
    );
    const shape = arcShape(arcInBox({ start: 270, end: 90 }, { width: 200, height: 200 }));
    const run = trackRun(shape);
    const spots = runPlaces([40, 40], 0, run.length, 'start', 0);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-shape', 'arc');
    expectAt(items()[0]!, shape, spots[0]!.center / run.length);
    expectAt(items()[1]!, shape, spots[1]!.center / run.length);
  });

  describe("the arc's direction sets which end the first item sits at", () => {
    const firstX = (arc: { start: number; end: number; direction?: 'cw' | 'ccw' }, dir?: 'rtl') => {
      render(
        <div dir={dir}>
          <Along arc={arc} align="start">
            <Bar schema={actions('a', 'b')} label="Tools" />
          </Along>
        </div>,
      );
      const [a, b] = items().map((el) => placed(el));
      cleanup();
      return { a: a!, b: b! };
    };

    test('a clockwise top arc starts at its left end, a counterclockwise one at its right', () => {
      const cw = firstX({ start: 270, end: 90 });
      const ccw = firstX({ start: 90, end: 270, direction: 'ccw' });
      expect(cw.a.x).toBeLessThan(cw.b.x);
      expect(ccw.a.x).toBeGreaterThan(ccw.b.x);
      expect(ccw.a.x).toBeCloseTo(200 - cw.a.x);
    });

    test('a clockwise bottom arc starts at its right end, each item still upright', () => {
      const { a, b } = firstX({ start: 90, end: 270 });
      expect(a.x).toBeGreaterThan(b.x);
      expect(a.y).toBeGreaterThan(100);
      for (const p of [a, b]) expect(Math.abs(p.angle)).toBeLessThan(90);
    });

    test('right to left mirrors it: a clockwise top arc starts at its right end', () => {
      const { a, b } = firstX({ start: 270, end: 90 }, 'rtl');
      expect(a.x).toBeGreaterThan(b.x);
    });
  });
});

describe('Bar along a curve: popovers open away from the center', () => {
  const sideOfItem = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Width' }));
    return document.querySelector('[data-weasel-overlay]')!.getAttribute('data-placement');
  };
  const width: PrefGroup = { name: 'Tools', children: { width: { name: 'Width', as: 'panel', children: { w: { kind: 'number', name: 'W', description: '', default: 4 } as PrefLeaf } } } };

  test('an item on the top of a ring opens its popover upward', () => {
    render(<Bar schema={width} values={{ width: 4 }} shape={arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 })} label="Tools" />);
    expect(sideOfItem()).toBe('top');
  });

  test('an item on the bottom of a ring, whose run is flipped, opens its popover downward', () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 120, end: 240 });
    expect(trackRun(shape).flipped).toBe(true);
    render(<Bar schema={width} values={{ width: 4 }} shape={shape} label="Tools" />);
    expect(sideOfItem()).toBe('bottom');
  });
});

describe('Bar along a curve: scroll mode', () => {
  // 157 px of arc holding seven 40 px items: a to d, a divider, then e and f.
  const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
  const schema: PrefGroup = { name: 'Tools', children: { ...actions('a', 'b', 'c', 'd').children, more: actions('e', 'f') } };
  const marks = () => Array.from(screen.getByRole('toolbar').querySelectorAll('[data-more-past]')).map((el) => el.getAttribute('data-more-past'));
  const turn = (at: string) => Number.parseFloat((screen.getByRole('toolbar').querySelector(`[data-more-past='${at}']`) as HTMLElement).style.getPropertyValue('--at-angle'));
  /** The wheel glides the run; this runs its frames until it lands. */
  const wheel = (deltaY: number) => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    fireEvent.wheel(screen.getByRole('toolbar'), { deltaY });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  };
  /** Where a chevron `out` px past an end of the run sits: on round the arc, clear of the item fading there. */
  const pastEnd = (out: number) => runStationAt(trackRun(shape), out < 0 ? out : trackRun(shape).length + out, 0, 'follow');

  test('items past the end are marked past, dividers included, and a chevron points out of that end', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    const divider = screen.getByRole('toolbar').querySelector(':scope > [role="separator"]')!;
    expect(divider).toHaveAttribute('data-clipped', 'past');
    expect(items().at(-1)).toHaveAttribute('data-clipped', 'past');
    expect(marks()).toEqual(['end']);
    expect(turn('end')).toBeCloseTo(pastEnd(10).angle - 90);
  });

  test('right to left, the chevron past the end sits at the left and points out of it', () => {
    render(<div dir="rtl"><Bar schema={schema} shape={shape} label="Tools" /></div>);
    expect(marks()).toEqual(['end']);
    const end = runStationAt(trackRun(shape, 0, 1, { direction: 'rtl' }), trackRun(shape).length + 10, 0, 'follow');
    expect(end.point.x).toBeLessThan(shape.at(0.5).point.x);
    expect(turn('end')).toBeCloseTo(end.angle + 90);
  });

  test('the wheel scrolls the run, moving the chevron to the start', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    wheel(1000);
    expect(items()[0]).toHaveAttribute('data-clipped', 'past');
    expect(items().at(-1)).toHaveAttribute('data-clipped', 'none');
    expect(marks()).toEqual(['start']);
    expect(turn('start')).toBeCloseTo(pastEnd(-10).angle + 90);
  });

  test('an item part past an end slides on round the arc, fading by how much of it is off the run', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    // 30 px back, `a` (0..40, no gap in jsdom) spans -30..10: its middle is 10 px before the run's start.
    wheel(30);
    const a = items()[0]!;
    expect(a).toHaveAttribute('data-clipped', 'part');
    const want = runStationAt(trackRun(shape), -10, 0, 'follow');
    const got = placed(a);
    expect(got.x).toBeCloseTo(want.point.x);
    expect(got.y).toBeCloseTo(want.point.y);
    expect(got.angle).toBeCloseTo(want.angle);
    expect(Number.parseFloat((a as HTMLElement).style.getPropertyValue('--along-shown'))).toBeCloseTo(0.25);
    // Wholly past the end and hidden, `f` waits at the end instead of reaching out past the bar's box.
    const f = items().at(-1)!;
    expect(f).toHaveAttribute('data-clipped', 'past');
    expect(placed(f).x).toBeCloseTo(trackRun(shape).at(1).point.x);
  });

  test('Tab reaching an item past the end brings it into view', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    const f = screen.getByRole('button', { name: 'f' });
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    act(() => f.focus());
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(f.closest('[data-bar-item]')).toHaveAttribute('data-clipped', 'none');
  });

  test('menu mode draws no band and no chevrons', () => {
    render(<Bar schema={schema} shape={shape} overflow="menu" label="Tools" />);
    expect(marks()).toEqual([]);
    expect(screen.getByRole('toolbar').querySelector(':scope > svg')).toBeNull();
  });
});

describe('Bar along a curve: dragging the run', () => {
  const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
  const run = trackRun(shape);
  // Groups that open, so each item is a popover trigger.
  const panel = (name: string): PrefGroup => ({ name, as: 'panel', children: { v: { kind: 'number', name: `${name} value`, description: '', default: 4 } as PrefLeaf } });
  const fields: PrefGroup = { name: 'Tools', children: Object.fromEntries(['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((n) => [n, panel(n)])) };
  const values = Object.fromEntries(Object.keys(fields.children).map((n) => [n, 4]));

  afterEach(() => {
    vi.useRealTimers();
  });

  test('marks an overflowing run so touch drags it rather than panning the page', () => {
    render(<Bar schema={fields} values={values} shape={shape} label="Tools" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-scrolls');
    cleanup();
    render(<Bar schema={fields} values={values} shape={shape} overflow="menu" label="Tools" />);
    expect(screen.getByRole('toolbar')).not.toHaveAttribute('data-scrolls');
  });

  // A touch held long raises no click after its release, and react-aria then clicks the trigger itself 80 ms on.
  test.each([['with', true], ['without', false]])('a drag that starts on a popover trigger scrolls the run and opens nothing, %s a click after it', (_, clicks) => {
    vi.useFakeTimers();
    // A proxy for the browser: jsdom's setPointerCapture does nothing, so the retargeting it would do is played here —
    // once an element captures the pointer, the release and its click go to that element, not the one under the pointer.
    let captor: Element | null = null;
    const proto = Element.prototype as { setPointerCapture?: Element['setPointerCapture'] };
    const real = proto.setPointerCapture;
    proto.setPointerCapture = function capture(this: Element) {
      captor = this;
    };
    onTestFinished(() => {
      proto.setPointerCapture = real;
    });
    render(<Bar schema={fields} values={values} shape={shape} label="Tools" />);
    const trigger = screen.getByRole('button', { name: 'n2' });
    const at = (g: number) => {
      const { point } = run.at(g);
      return { pointerId: 1, button: 0, pointerType: 'mouse', pressure: 0.5, clientX: point.x, clientY: point.y };
    };
    fireEvent.pointerDown(trigger, { ...at(0.5), buttons: 1 });
    fireEvent.pointerMove(document, { ...at(0.3), buttons: 1 });
    const released = captor ?? trigger;
    fireEvent.pointerUp(released, { ...at(0.3), buttons: 0 });
    if (clicks) fireEvent.click(released, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(items()[0]).not.toHaveAttribute('data-clipped', 'none');
  });

  test('a Cmd-press does not scroll the run, and a plain drag still does', () => {
    const mod = isApplePlatform() ? { metaKey: true } : { ctrlKey: true };
    render(<Bar schema={fields} values={values} shape={shape} label="Tools" onReorder={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'n2' });
    const at = (g: number) => {
      const { point } = run.at(g);
      return { pointerId: 1, button: 0, pointerType: 'mouse', pressure: 0.5, clientX: point.x, clientY: point.y };
    };
    const drag = (mods: object) => {
      fireEvent.pointerDown(trigger, { ...at(0.5), buttons: 1, ...mods });
      fireEvent.pointerMove(document, { ...at(0.3), buttons: 1, ...mods });
      fireEvent.pointerUp(document, { ...at(0.3), buttons: 0, ...mods });
    };
    drag(mod);
    expect(items()[0]).toHaveAttribute('data-clipped', 'none');
    drag({});
    expect(items()[0]).not.toHaveAttribute('data-clipped', 'none');
  });
});
