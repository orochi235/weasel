import { describe, expect, test } from 'vitest';
import { frameRate } from './fpsAverage';

describe('frameRate', () => {
  test('one frame time is its rate', () => {
    expect(frameRate([1000 / 60])).toBe(60);
  });

  test('counts frames over the time they took, so uneven frames do not overstate it', () => {
    expect(frameRate([10, 90])).toBe(20);
    expect(frameRate([10, 40])).toBe(40);
  });

  test('returns 0 for no frames', () => {
    expect(frameRate([])).toBe(0);
  });

  test('rounds to the nearest integer', () => {
    expect(frameRate([16, 17, 17])).toBe(60);
  });
});
