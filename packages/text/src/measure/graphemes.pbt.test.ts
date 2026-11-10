/** `graphemeEnds` asks the segmenter only about stretches that need it; it must still answer as the whole text does. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { graphemeEnds } from './graphemes';
import { mixedText, runs, segmenterEnds, tally } from '../pbt.fixture';

const RUNS = 500;

const text = fc.oneof(
  mixedText(20),
  fc.string({ unit: 'binary', maxLength: 12 }),
  fc.array(fc.oneof(mixedText(4), fc.string({ unit: 'binary', maxLength: 3 })), { maxLength: 6 }).map((a) => a.join('')),
);

describe('graphemeEnds, property', () => {
  it('ends every cluster where Intl.Segmenter does, lone surrogates included, into a reused array too', () => {
    const t = tally();
    const reused: number[] = [99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80];
    fc.assert(fc.property(text, (s) => {
      const want = segmenterEnds(s);
      if (want.length < s.length) t.count('joined');
      expect(graphemeEnds(s), JSON.stringify(s)).toEqual(want);
      expect(graphemeEnds(s, reused)).toEqual(want);
    }), runs(RUNS));
    t.atLeast('joined', 50);
  });
});
