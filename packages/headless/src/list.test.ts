import { describe, expect, it } from 'vitest';
import { firstStop, rovingKey, stepStop } from './list';

type Item = { label: string; rule?: boolean };
const items: Item[] = [{ label: 'a', rule: true }, { label: 'b' }, { label: 'c', rule: true }, { label: 'd' }];
const shape = { canStop: (i: Item) => !i.rule };

describe('firstStop', () => {
  it('skips items the highlight cannot land on', () => {
    expect(firstStop(items, shape)).toBe(1);
  });
  it('lands on the first item when every item is a stop', () => {
    expect(firstStop(items)).toBe(0);
  });
  it('is null for a list with no stops', () => {
    expect(firstStop([{ label: 'x', rule: true }], shape)).toBeNull();
    expect(firstStop([])).toBeNull();
  });
});

describe('stepStop', () => {
  it('skips non-stops and wraps by default', () => {
    expect(stepStop(items, 1, 1, shape)).toBe(3);
    expect(stepStop(items, 3, 1, shape)).toBe(1);
    expect(stepStop(items, 1, -1, shape)).toBe(3);
  });
  it('starts from the first or last stop from nothing', () => {
    expect(stepStop(items, null, 1, shape)).toBe(1);
    expect(stepStop(items, null, -1, shape)).toBe(3);
  });
  it('holds at an end without wrap', () => {
    const still = { ...shape, wrap: false };
    expect(stepStop(items, 3, 1, still)).toBe(3);
    expect(stepStop(items, 1, -1, still)).toBe(1);
    expect(stepStop(items, 1, 1, still)).toBe(3);
  });
});

describe('rovingKey', () => {
  it('moves on the vertical arrows, Home and End', () => {
    expect(rovingKey(items, 1, 'ArrowDown', shape)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 3, 'ArrowUp', shape)).toEqual({ handled: true, at: 1 });
    expect(rovingKey(items, 3, 'Home', shape)).toEqual({ handled: true, at: 1 });
    expect(rovingKey(items, 1, 'End', shape)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 1, 'ArrowRight', shape)).toEqual({ handled: false });
  });
  it('moves on the horizontal arrows for a horizontal list', () => {
    const row = { ...shape, orientation: 'horizontal' as const };
    expect(rovingKey(items, 1, 'ArrowRight', row)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 1, 'ArrowLeft', row)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 1, 'ArrowDown', row)).toEqual({ handled: false });
  });
  it('moves on all four arrows for a list laid out both ways', () => {
    const both = { ...shape, orientation: 'both' as const };
    expect(rovingKey(items, 1, 'ArrowRight', both)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 1, 'ArrowDown', both)).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 3, 'ArrowLeft', both)).toEqual({ handled: true, at: 1 });
    expect(rovingKey(items, 3, 'ArrowUp', both)).toEqual({ handled: true, at: 1 });
  });
  it('swaps Left and Right right to left, and leaves Up and Down alone', () => {
    const rtl = { orientation: 'both' as const, dir: 'rtl' as const };
    expect(rovingKey(items, 1, 'ArrowLeft', rtl)).toEqual({ handled: true, at: 2 });
    expect(rovingKey(items, 1, 'ArrowRight', rtl)).toEqual({ handled: true, at: 0 });
    expect(rovingKey(items, 1, 'ArrowDown', rtl)).toEqual({ handled: true, at: 2 });
    expect(rovingKey(items, 1, 'ArrowUp', { dir: 'rtl' })).toEqual({ handled: true, at: 0 });
  });
  it('holds at an end without wrap', () => {
    expect(rovingKey(items, 3, 'ArrowDown', { wrap: false })).toEqual({ handled: true, at: 3 });
    expect(rovingKey(items, 0, 'ArrowUp', { wrap: false })).toEqual({ handled: true, at: 0 });
  });
});
