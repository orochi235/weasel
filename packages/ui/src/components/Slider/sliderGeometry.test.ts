import { expect, test } from 'vitest';
import { stubRect } from './testing/stubRect';
import { lineGeometry } from './sliderGeometry';

test('a line measures a client point against its rail', () => {
  const rail = document.createElement('div');
  stubRect(rail, { left: 0, width: 200, height: 24, top: 0, bottom: 24 });
  const geo = lineGeometry(() => rail, () => null);
  expect(geo.measure(50, 12)).toEqual({ g: 0.25, gRaw: 0.25, dist: 0, across: 0, length: 200, thickness: 24 });
  expect(geo.measure(50, 60)!.across).toBe(48);
  expect(geo.measure(260, 12)).toMatchObject({ g: 1, gRaw: 1.3 });
  expect(geo.place(0.5)).toEqual({ left: '50%' });
  expect(geo.curved).toBe(false);
});

test('an unmounted rail measures nothing', () => expect(lineGeometry(() => null, () => null).measure(0, 0)).toBeNull());
