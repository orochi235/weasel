import { afterAll, afterEach, beforeAll, describe, expect, onTestFinished, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { arcShape, lineShape, trackRun, type TrackShape } from '@weasel-js/geom';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Along, arcInBox } from '../Along';
import { Bar } from './Bar';
import { runPlaces } from './runPlaces';

// jsdom lays nothing out: every element is 40 wide untransformed, and every box 200 by 200 at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box() {
    return { x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 40 });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset);
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
  test('on a shape every leaf but an action opens from a button', () => {
    const schema: PrefGroup = { name: 'Tools', children: { width: { kind: 'number', name: 'Width', description: '', default: 4 }, undo: action('Undo') } };
    render(<Bar schema={schema} values={{ width: 4 }} shape={arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 })} label="Tools" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-shape', 'arc');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Width' }));
    expect(screen.getByRole('spinbutton', { name: 'Width' })).toBeInTheDocument();
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

  test('menu mode keeps what fits along the arc and puts More last in reading order', () => {
    const shape = arcShape({ center: { x: 100, y: 100 }, radius: 100, start: 315, end: 45 });
    expect(shape.length).toBeCloseTo(157.08, 2);
    render(<Bar schema={six} shape={shape} overflow="menu" label="Tools" />);
    const kept = items();
    expect(kept.map((el) => el.getAttribute('data-bar-item'))).toEqual(['a', 'b']);
    const xs = kept.map((el) => placed(el).x);
    expect(placed(more()).x).toBeGreaterThan(Math.max(...xs));
    expect(xs[0]!).toBeLessThan(xs[1]!);
    fireEvent.click(within(more() as HTMLElement).getByRole('button', { name: 'More' }));
    const menu = screen.getByRole('dialog', { name: 'More' });
    expect(within(menu).getAllByRole('button').map((b) => b.textContent)).toEqual(['c', 'd', 'e', 'f']);
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
});

describe('Bar along a curve: popovers open away from the center', () => {
  const sideOfItem = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Width' }));
    return document.querySelector('[data-weasel-overlay]')!.getAttribute('data-placement');
  };
  const width: PrefGroup = { name: 'Tools', children: { width: { kind: 'number', name: 'Width', description: '', default: 4 } } };

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

  test('items past the end are marked past, dividers included, and a chevron points out of that end', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    const divider = screen.getByRole('toolbar').querySelector(':scope > [role="separator"]')!;
    expect(divider).toHaveAttribute('data-clipped', 'past');
    expect(items().at(-1)).toHaveAttribute('data-clipped', 'past');
    expect(marks()).toEqual(['end']);
    expect(turn('end')).toBeCloseTo(trackRun(shape).at(1).angle - 90);
  });

  test('the wheel scrolls the run, moving the chevron to the start', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    fireEvent.wheel(screen.getByRole('toolbar'), { deltaY: 1000 });
    expect(items()[0]).toHaveAttribute('data-clipped', 'past');
    expect(items().at(-1)).toHaveAttribute('data-clipped', 'none');
    expect(marks()).toEqual(['start']);
    expect(turn('start')).toBeCloseTo(trackRun(shape).at(0).angle + 90);
  });

  test('an item part past an end slides on along that end, rather than stopping there', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    // 30 px back, `a` (0..40, no gap in jsdom) spans -30..10: its middle is 10 px before the run's start.
    fireEvent.wheel(screen.getByRole('toolbar'), { deltaY: 30 });
    const a = items()[0]!;
    expect(a).toHaveAttribute('data-clipped', 'part');
    const start = trackRun(shape).at(0);
    const got = placed(a);
    expect(got.x).toBeCloseTo(start.point.x - 10 * start.tangent.x);
    expect(got.y).toBeCloseTo(start.point.y - 10 * start.tangent.y);
    expect(got.angle).toBeCloseTo(start.angle);
    // Wholly past the end and hidden, `f` waits at the end instead of reaching out past the bar's box.
    const f = items().at(-1)!;
    expect(f).toHaveAttribute('data-clipped', 'past');
    expect(placed(f).x).toBeCloseTo(trackRun(shape).at(1).point.x);
  });

  test('Tab reaching an item past the end brings it into view', () => {
    render(<Bar schema={schema} shape={shape} label="Tools" />);
    const f = screen.getByRole('button', { name: 'f' });
    act(() => f.focus());
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
  const number = (name: string) => ({ kind: 'number', name, description: '', default: 4 }) as PrefLeaf;
  const fields: PrefGroup = { name: 'Tools', children: Object.fromEntries(['n1', 'n2', 'n3', 'n4', 'n5', 'n6'].map((n) => [n, number(n)])) };
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
});
