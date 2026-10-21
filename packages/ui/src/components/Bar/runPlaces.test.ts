import { describe, expect, test } from 'vitest';
import { runPlaces } from './runPlaces';

describe('runPlaces', () => {
  test('a run shorter than its room sits centered', () => expect(runPlaces([20, 20], 10, 100, 'center', 0).map((s) => s.center)).toEqual([35, 65]));
  test('align start and end push it to the reading start and end', () => {
    expect(runPlaces([20, 20], 10, 100, 'start', 0).map((s) => s.center)).toEqual([10, 40]);
    expect(runPlaces([20, 20], 10, 100, 'end', 0).map((s) => s.center)).toEqual([60, 90]);
  });
  test('a run longer than its room lays from the start less the offset, and marks what lies past the ends', () => {
    expect(runPlaces([40, 40, 40, 40], 0, 100, 'center', 50)).toEqual([
      { center: -30, clipped: 'past' }, { center: 10, clipped: 'part' }, { center: 50, clipped: 'none' }, { center: 90, clipped: 'part' },
    ]);
  });
  test('no items is no places', () => expect(runPlaces([], 4, 100, 'center', 0)).toEqual([]));
});
