import { expect, test } from 'vitest';
import { MARK_LIMIT, withMark } from './LensRimView';

test('a mark past the limit lets the oldest go', () => {
  let marks = Array.from({ length: MARK_LIMIT }, (_, i) => ({ x: i, y: 0 }));
  marks = withMark(marks, { x: -1, y: 0 });
  expect(marks).toHaveLength(MARK_LIMIT);
  expect(marks[0]).toEqual({ x: 1, y: 0 });
  expect(marks.at(-1)).toEqual({ x: -1, y: 0 });
});
