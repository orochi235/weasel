import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerFontOutlines, glyphOutline, type FaceEmbedding } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { resolveRuns } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch } from './testing/fontFixtures';
import { measureRuns } from './layoutEntries';
import type { ShapedGlyph, TextShaper } from './shaperSeam';

const SFNT = new ArrayBuffer(8);

function registerFace(family: string): void {
  registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000,
      ascender: 0.8,
      advanceOf: () => 0.5,
      kernOf: () => 0,
      glyphD: (cp: number) => `M0 0L${cp} 0Z`,
      embedding: () => ({ sfnt: SFNT } as unknown as FaceEmbedding),
    }),
  });
}

const glyph = (gid: number, cluster: number, advance: number): ShapedGlyph =>
  ({ gid, cluster, advance, dx: 0, dy: 0, rtl: false });

/** Shapes every text as one cluster: the opener's glyph, then a zero-width mark glyph. */
const clusterShaper: TextShaper = {
  shape: () => [glyph(3, 0, 0.5), glyph(9, 0, 0)],
  glyphD: (_face, gid) => `g${gid}`,
  hasFeature: () => false,
};

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});
afterEach(() => _resetFontRegistryForTests());

describe('measureRuns, a shaped cluster opening on a code point layout handles itself', () => {
  for (const [name, opener] of [['space', ' '], ['tab', '\t'], ['soft hyphen', '­']] as const) {
    it(`still draws a mark clustered onto a ${name}`, async () => {
      registerFace('marks');
      glyphOutline('marks', 400, 'normal', 65);
      await new Promise((r) => setTimeout(r, 0));
      const runs = resolveRuns(
        [{ text: `${opener}́` }],
        resolveTextStyle({ fontFamily: 'marks', fontSize: 100 }, { fill: DEFAULT_TEXT_FILL }),
      );
      const [first, mark] = measureRuns(runs, 4, undefined, undefined, clusterShaper);
      expect(first.shaped).toBeNull();
      expect(mark.cp).toBe(0x301);
      expect(mark.drawsInk).toBe(true);
      expect(mark.advance).toBe(0.5 * 100);
    });
  }
});
