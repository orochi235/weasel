import { describe, expect, test } from 'vitest';
import { roundness, thinLabels, type LabelBox } from './thinLabels';

const box = (left: number, right: number, rank = 0, round = 1): LabelBox => ({ left, right, rank, roundness: round });

describe('thinLabels', () => {
  test('keeps every label when they are all clear of each other', () => {
    expect(thinLabels([box(0, 10), box(20, 30), box(40, 50)], 4)).toEqual([true, true, true]);
  });

  test('drops a label that comes within the gap of a kept one, though it does not overlap', () => {
    expect(thinLabels([box(0, 10), box(12, 22)], 4)).toEqual([true, false]);
    expect(thinLabels([box(0, 10), box(14, 24)], 4)).toEqual([true, true]);
  });

  test('always keeps the ends, and drops the ticks that would crowd them', () => {
    const ends = [box(0, 20, -Infinity), box(80, 100, -Infinity)];
    expect(thinLabels([...ends, box(18, 30), box(45, 55), box(70, 82)], 4)).toEqual([true, true, false, true, false]);
  });

  test('keeps the ends even when they collide with each other', () => {
    expect(thinLabels([box(0, 20, -Infinity), box(10, 30, -Infinity)], 4)).toEqual([true, true]);
  });

  test('a lower rank wins a collision whatever its roundness', () => {
    expect(thinLabels([box(0, 10, 1, 100), box(5, 15, 0, 1)], 4)).toEqual([false, true]);
  });

  test('a rounder value wins a collision between equal ranks', () => {
    expect(thinLabels([box(0, 10, 0, 1 / 12), box(8, 18, 0, 1 / 6), box(16, 26, 0, 1 / 3)], 4)).toEqual([
      true,
      false,
      true,
    ]);
  });

  test('a tie in rank and roundness goes to the leftmost label', () => {
    expect(thinLabels([box(8, 18), box(0, 10)], 4)).toEqual([false, true]);
  });

  test('a run of crowded labels keeps every other one rather than only the first', () => {
    const run = [0, 1, 2, 3, 4].map((i) => box(i * 12, i * 12 + 10, 0, i % 2 === 0 ? 2 : 1));
    expect(thinLabels(run, 4)).toEqual([true, false, true, false, true]);
  });
});

describe('roundness', () => {
  test('ranks decimals by the coarsest 1-2-5 step they sit on', () => {
    expect(roundness(50)).toBe(50);
    expect(roundness(40)).toBe(20);
    expect(roundness(30)).toBe(10);
    expect(roundness(99)).toBe(1);
    expect(roundness(0.25)).toBe(0.25);
    expect(roundness(0.1)).toBeCloseTo(0.1);
  });

  test('ranks fractions by their denominator', () => {
    expect(roundness(1 / 3)).toBe(1 / 3);
    expect(roundness(1 / 12)).toBe(1 / 12);
    expect(roundness(2 / 3)).toBe(1 / 3);
    expect(roundness(1 / 45)).toBe(1 / 45);
    expect(roundness(1 / 3)).toBeGreaterThan(roundness(1 / 6));
  });

  test('a value on no step ranks last', () => {
    expect(roundness(Math.PI)).toBe(0);
  });
});
