import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { arcShape, trackRun, type Point } from '@weasel-js/geom';
import { Along } from '../Along';
import { Slider, type SliderProps, type TrackCtx } from './index';

// jsdom lays nothing out: a thumb is 10 by 20 here and 10 wide untransformed, everything else 200 by 200 at (0, 0).
const realRect = Element.prototype.getBoundingClientRect;
const realOffset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!;
beforeAll(() => {
  Element.prototype.getBoundingClientRect = function box(this: Element) {
    const [width, height] = this.getAttribute('role') === 'slider' ? [10, 20] : [200, 200];
    return { x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON: () => {} } as DOMRect;
  };
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.getAttribute('role') === 'slider' ? 10 : 0; },
  });
});
afterAll(() => {
  Element.prototype.getBoundingClientRect = realRect;
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', realOffset);
});

const top = arcShape({ center: { x: 100, y: 100 }, radius: 80, start: 300, end: 60 });
const run = trackRun(top);
const at = (g: number): Point => run.at(g).point;
/** The point on top's circle `deg` degrees clockwise from 12 o'clock. */
const onCircle = (deg: number): Point => {
  const r = (deg * Math.PI) / 180;
  return { x: 100 + 80 * Math.sin(r), y: 100 - 80 * Math.cos(r) };
};

function mount(props: Partial<SliderProps> = {}) {
  const onInput = vi.fn();
  const onChange = vi.fn();
  const view = render(
    <Slider shape={top} thumbFit="overhang" min={0} max={100} thumbs={[{ value: 25 }]} onInput={onInput} onChange={onChange} {...props} />,
  );
  const band = view.container.querySelector('[data-slider-band]') as Element;
  const thumbs = Array.from(view.container.querySelectorAll<HTMLElement>('[role="slider"]'));
  return { ...view, onInput, onChange, band, thumbs };
}

const values = (fn: ReturnType<typeof vi.fn>): number[] => fn.mock.calls.at(-1)![0].map((t: { value: number }) => t.value);
const placed = (el: HTMLElement) => ({ x: el.style.getPropertyValue('--at-x'), y: el.style.getPropertyValue('--at-y') });

function drag(el: HTMLElement, from: Point, to: Point, init: { shiftKey?: boolean } = {}) {
  fireEvent.pointerDown(el, { clientX: from.x, clientY: from.y, pointerId: 1, ...init });
  fireEvent.pointerMove(document, { clientX: to.x, clientY: to.y, pointerId: 1 });
}

describe('Slider on a curve', () => {
  test("a thumb on an arc sits at the arc's point for its value, tipped", () => {
    const { thumbs } = mount();
    const p = run.at(0.25);
    expect(thumbs[0]!.style.getPropertyValue('--at-x')).toBe(`${p.point.x}px`);
    expect(thumbs[0]!.style.getPropertyValue('--at-y')).toBe(`${p.point.y}px`);
    expect(thumbs[0]!.style.getPropertyValue('--at-angle')).toBe(`${p.angle}deg`);
  });

  test('a press on the band picks the value at the nearest point along the arc', () => {
    const { band, onInput } = mount({ step: 1 });
    const { point: p, normal: n } = run.at(0.75);
    fireEvent.pointerDown(band, { clientX: p.x - 3 * n.x, clientY: p.y - 3 * n.y, pointerId: 1 });
    expect(onInput).toHaveBeenLastCalledWith([{ value: 75 }]);
  });

  test('a thumb dragged along the arc follows the projected fraction', () => {
    const { thumbs, onInput } = mount({ step: 1 });
    drag(thumbs[0]!, at(0.25), at(0.6));
    expect(values(onInput)).toEqual([60]);
  });

  test('shift-drag moves every thumb by the difference of the projected fractions', () => {
    const { thumbs, onInput } = mount({ step: 1, allowShiftAll: true, thumbs: [{ value: 20 }, { value: 40 }] });
    drag(thumbs[0]!, at(0.2), at(0.3), { shiftKey: true });
    expect(values(onInput)).toEqual([30, 50]);
  });

  test('shift-drag past an end of the arc keeps moving by angle, as a line keeps moving past its end', () => {
    const { thumbs, onInput } = mount({ step: 1, allowShiftAll: true, thumbs: [{ value: 70 }, { value: 80 }] });
    // 0.05 of the 120° sweep past the end is 66°: a clamped projection would stop the move at 0.1.
    drag(thumbs[0]!, at(0.9), onCircle(66), { shiftKey: true });
    expect(values(onInput)).toEqual([85, 95]);
    fireEvent.pointerMove(document, { clientX: onCircle(90).x, clientY: onCircle(90).y, pointerId: 1 });
    expect(values(onInput)).toEqual([90, 100]);
  });

  test('a stop attracts within STOP_SNAP_PX measured along the arc', () => {
    const near = mount({ stops: [50], thumbs: [{ value: 0 }] });
    const p = at(0.5 + 6 / run.length);
    fireEvent.pointerDown(near.band, { clientX: p.x, clientY: p.y, pointerId: 1 });
    expect(values(near.onInput)).toEqual([50]);
    fireEvent.pointerUp(document, { pointerId: 1 });
    near.unmount();

    const far = mount({ stops: [50], thumbs: [{ value: 0 }] });
    const q = at(0.5 + 12 / run.length);
    fireEvent.pointerDown(far.band, { clientX: q.x, clientY: q.y, pointerId: 1 });
    expect(values(far.onInput)[0]).not.toBe(50);
    expect(values(far.onInput)[0]).toBeCloseTo(50 + (12 / run.length) * 100, 5);
  });

  // The band's stroke-width is the 24px fallback in jsdom, so the boundary sits 36px off the arc.
  test.each([[37, true], [35, false]])('dragging %ipx out from the arc removes the thumb: %s', (off, removed) => {
    const onRemoveThumb = vi.fn(() => true);
    const { thumbs, onChange } = mount({ thumbs: [{ value: 50 }], onRemoveThumb });
    const { point, normal } = run.at(0.5);
    drag(thumbs[0]!, point, { x: point.x + normal.x * off, y: point.y + normal.y * off });
    fireEvent.pointerUp(document, { pointerId: 1 });
    expect(onRemoveThumb).toHaveBeenCalledTimes(removed ? 1 : 0);
    expect(values(onChange)).toHaveLength(removed ? 0 : 1);
  });

  test('a thumb on a curve has no aria-orientation; a straight one keeps horizontal', () => {
    const curved = mount();
    expect(curved.thumbs[0]!.hasAttribute('aria-orientation')).toBe(false);
    curved.unmount();
    const straight = mount({ shape: undefined });
    expect(straight.thumbs[0]!.getAttribute('aria-orientation')).toBe('horizontal');
  });

  test('arrow, Page, Home and End step a thumb on a curve as on a line', () => {
    const { thumbs, onInput } = mount({ step: 1, thumbs: [{ value: 50 }] });
    const press = (key: string) => { fireEvent.keyDown(thumbs[0]!, { key }); return values(onInput); };
    expect(press('ArrowRight')).toEqual([51]);
    expect(press('PageUp')).toEqual([60]);
    expect(press('Home')).toEqual([0]);
    expect(press('End')).toEqual([100]);
  });

  test('thumbFit inside starts the span half a thumb along the arc', () => {
    const { thumbs } = mount({ thumbFit: undefined, thumbs: [{ value: 0 }] });
    const start = trackRun(top, 5 / top.length, 1 - 5 / top.length).at(0).point;
    expect(placed(thumbs[0]!)).toEqual({ x: `${start.x}px`, y: `${start.y}px` });
  });

  test('an arc shorter than a thumb collapses the span to its middle rather than inverting', () => {
    const short = arcShape({ center: { x: 100, y: 100 }, radius: 2, start: 0, end: 90 });
    const { thumbs } = mount({ shape: short, thumbFit: undefined, thumbs: [{ value: 0 }, { value: 100 }] });
    const mid = short.at(0.5).point;
    expect(placed(thumbs[0]!)).toEqual({ x: `${mid.x}px`, y: `${mid.y}px` });
    expect(placed(thumbs[1]!)).toEqual(placed(thumbs[0]!));
  });

  test('the track painter gets the value span as a shape', () => {
    let seen: TrackCtx | undefined;
    mount({ renderTrack: (ctx) => { seen = ctx; return null; } });
    expect(seen!.shape.at(seen!.valueToFraction(25)).point).toEqual(run.at(0.25).point);
    expect(seen!.trackWidth).toBeCloseTo(run.length, 9);
  });

  test("a Slider's shape prop wins over Along's", () => {
    const { container } = render(
      <Along arc={{ start: 120, end: 240 }}>
        <Slider shape={top} thumbFit="overhang" min={0} max={100} thumbs={[{ value: 25 }]} onInput={() => {}} />
      </Along>,
    );
    const p = at(0.25);
    expect(placed(container.querySelector<HTMLElement>('[role="slider"]')!)).toEqual({ x: `${p.x}px`, y: `${p.y}px` });
  });

  test('a Slider inside Along follows its arc', () => {
    // A 200px box less an inset of 20 is top's circle.
    const { container } = render(
      <Along arc={{ start: 300, end: 60, inset: 20 }}>
        <Slider thumbFit="overhang" min={0} max={100} thumbs={[{ value: 25 }]} onInput={() => {}} />
      </Along>,
    );
    const thumb = container.querySelector<HTMLElement>('[role="slider"]')!;
    expect(thumb.closest('[data-shape]')?.getAttribute('data-shape')).toBe('arc');
    const p = at(0.25);
    expect(Number.parseFloat(placed(thumb).x)).toBeCloseTo(p.x, 9);
    expect(Number.parseFloat(placed(thumb).y)).toBeCloseTo(p.y, 9);
  });
});

describe('readouts along a curve', () => {
  test.each(['below-thumb', 'inline-after'] as const)('%s draws one readout per thumb at that thumb\'s place', (readoutPlacement) => {
    const { container, thumbs } = mount({ thumbs: [{ value: 25 }, { value: 75 }], readoutPlacement });
    const readouts = Array.from(container.querySelectorAll<HTMLElement>('[data-readout="below"]'));
    expect(readouts).toHaveLength(2);
    expect(container.querySelector('[data-readout="inline"]')).toBeNull();
    readouts.forEach((r, i) => expect(r.style.getPropertyValue('--at-x')).toBe(placed(thumbs[i]!).x));
  });

  test('placement none draws none', () => {
    expect(mount().container.querySelector('[data-readout]')).toBeNull();
  });
});
