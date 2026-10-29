import { describe, expect, it } from 'vitest';
import { attract, clampOrdered, crossEnd, sliderKey, stepStops, usableStops, type SliderKeyShape } from './slider';

describe('slider stops', () => {
  it('keeps the stops inside the range, deduped and ascending, with the first label given', () => {
    expect(usableStops([5, { value: 2, label: 'b' }, 20, { value: 5, label: 'e' }, 2], 0, 10)).toEqual([
      { value: 2, label: 'b' }, { value: 5, label: 'e' },
    ]);
    expect(usableStops(undefined, 0, 10)).toEqual([]);
  });

  it('attracts to the nearest stop within a track fraction', () => {
    const f = (v: number) => v / 100;
    expect(attract(48, [50, 60], 0.03, f)).toBe(50);
    expect(attract(40, [50, 60], 0.03, f)).toBe(40);
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
