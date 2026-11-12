import { describe, expect, it } from 'vitest';
import { attract, clampOrdered, crossEnd, evenMap, sliderAt, sliderKey, stepStops, usableStops, type SliderKeyShape } from './slider';
import { spanMap } from './span';

describe('slider stops', () => {
  it('keeps the stops inside the range, deduped and ascending, with the first label given', () => {
    expect(usableStops([5, { value: 2, label: 'b' }, 20, { value: 5, label: 'e' }, 2], 0, 10)).toEqual([
      { value: 2, label: 'b' }, { value: 5, label: 'e' },
    ]);
    expect(usableStops(undefined, 0, 10)).toEqual([]);
  });

  it('drops a NaN stop, which no thumb can rest on', () => {
    expect(usableStops([4, NaN, 2], 0, 10)).toEqual([{ value: 2 }, { value: 4 }]);
  });

  it('attracts to the nearest stop within a track fraction', () => {
    const f = (v: number) => v / 100;
    expect(attract(48, [50, 60], 0.03, f)).toBe(50);
    expect(attract(40, [50, 60], 0.03, f)).toBe(40);
  });

  it("attracts in the value's own units with no track map", () => {
    expect(attract(103, [0, 100, 200], 6)).toBe(100);
    expect(attract(150, [0, 100, 200], 6)).toBe(150);
    expect(attract(98, [95, 100], 6)).toBe(100);
    expect(attract(150, [], 6)).toBe(150);
  });

  it('steps by whole stops, saturating at the ends', () => {
    const stops = [0, 10, 20, 30];
    expect(stepStops(stops, 10, 1, 1)).toBe(20);
    expect(stepStops(stops, 15, 1, 1)).toBe(20);
    expect(stepStops(stops, 10, -1, 5)).toBe(0);
    expect(stepStops(stops, 30, 1, 1)).toBe(30);
  });

  it('keeps an ordered thumb a step inside its neighbors', () => {
    const thumbs = [{ value: 10 }, { value: 50 }, { value: 60 }];
    expect(clampOrdered(70, thumbs, 1, 0, 100, 1)).toBe(59);
    expect(clampOrdered(5, thumbs, 1, 0, 100, 1)).toBe(11);
  });

  it('crosses an endless end in one press', () => {
    expect(crossEnd(9, 2, 1, [0, 10], [-5, 15])).toBe(10);
    expect(crossEnd(10, 1, 1, [0, 10], [-5, 15])).toBe(15);
    expect(crossEnd(15, -1, 1, [0, 10], [-5, 15])).toBe(10);
    expect(crossEnd(5, 1, 1, [0, 10], [-5, 15])).toBeNull();
  });
});

describe('sliderKey', () => {
  const shape = (over: Partial<SliderKeyShape> = {}): SliderKeyShape => ({
    thumbs: [{ value: 50 }], index: 0, min: 0, max: 100, step: 1, ...over,
  });

  it('steps by one, ten with Shift or a Page key, and goes to the ends with Home and End', () => {
    expect(sliderKey('ArrowRight', false, shape())).toBe(51);
    expect(sliderKey('ArrowDown', true, shape())).toBe(40);
    expect(sliderKey('PageUp', false, shape())).toBe(60);
    expect(sliderKey('Home', false, shape())).toBe(0);
    expect(sliderKey('End', false, shape({ bounds: () => [20, 80] }))).toBe(80);
    expect(sliderKey('a', false, shape())).toBeNull();
  });

  it('mirrors the horizontal arrows right to left', () => {
    expect(sliderKey('ArrowRight', false, shape({ dir: 'rtl' }))).toBe(49);
  });

  it('moves by whole stops when there are any', () => {
    expect(sliderKey('ArrowRight', false, shape({ stops: [0, 25, 50, 75, 100] }))).toBe(75);
  });

  it('hands the arrows to keyStep', () => {
    expect(sliderKey('ArrowUp', true, shape({ keyStep: steps => 50 * 2 ** (steps / 10) }))).toBe(100);
  });

  it('reads bounds only for a key it answers to', () => {
    let reads = 0;
    sliderKey('a', false, shape({ bounds: () => { reads++; return [0, 100]; } }));
    expect(reads).toBe(0);
  });

  it('keeps an ordered thumb inside its neighbors', () => {
    expect(sliderKey('PageUp', false, shape({ thumbs: [{ value: 50 }, { value: 55 }], ordered: true }))).toBe(54);
  });
});

describe('evenMap', () => {
  const map = evenMap([0, 10, 100, 1000]);

  it('gives each gap between stops the same length of track', () => {
    expect(map.toFraction(10)).toBeCloseTo(1 / 3, 12);
    expect(map.toFraction(100)).toBeCloseTo(2 / 3, 12);
    expect(map.toFraction(55)).toBeCloseTo(0.5, 12);
    expect(map.toValue(0.5)).toBeCloseTo(55, 9);
  });

  it('holds a value or a place past either end at that end', () => {
    expect(map.toFraction(-5)).toBe(0);
    expect(map.toFraction(5000)).toBe(1);
    expect(map.toValue(-1)).toBe(0);
    expect(map.toValue(2)).toBe(1000);
  });
});

describe('sliderAt', () => {
  const track = { min: 0, max: 100, ...spanMap({ from: 0, to: 100 }) };

  it("reads the track's value at the place, held inside min to max", () => {
    expect(sliderAt(0.25, track)).toBe(25);
    expect(sliderAt(-0.5, track)).toBe(0);
    expect(sliderAt(1.5, track)).toBe(100);
  });

  it('lands on the step grid, which starts at the origin', () => {
    expect(sliderAt(0.26, { ...track, step: 10 })).toBe(30);
    expect(sliderAt(0.26, { ...track, step: 10, origin: 3 })).toBe(23);
  });

  it('pulls onto a stop within reach, and passes it by when free', () => {
    const stops = [40, 80];
    expect(sliderAt(0.42, { ...track, stops, pull: 0.03 })).toBe(40);
    expect(sliderAt(0.5, { ...track, stops, pull: 0.03 })).toBe(50);
    expect(sliderAt(0.42, { ...track, stops, pull: 0.03, free: true })).toBe(42);
    expect(sliderAt(0.42, { ...track, stops })).toBe(42);
  });

  it('picks only a stop under strict, however far, free or not', () => {
    expect(sliderAt(0.1, { ...track, stops: [40, 80], strict: true, free: true })).toBe(40);
  });

  it('reads a window onto a longer range, past its edges', () => {
    const windowed = { min: 0, max: Infinity, ...spanMap({ from: 200, to: 300 }) };
    expect(sliderAt(0.5, windowed)).toBe(250);
    expect(sliderAt(1.5, windowed)).toBe(350);
    expect(sliderAt(-3, windowed)).toBe(0);
    expect(sliderAt(0.52, { ...windowed, stops: [100, 251], pull: 0.02 })).toBe(251);
  });
});
