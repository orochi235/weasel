/**
 * The README's usage example, run as written against a real face: a consumer copies it first, and nothing else
 * checks that it paints anything.
 */
import { it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerFontOutlines, loadFontOutlines } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import {
  toRuns, resolveTextStyle, resolveRuns, layoutRuns, paintRuns, DEFAULT_TEXT_FILL,
} from '@weasel-js/text';

const TTF = resolve(import.meta.dirname, '../../../assets/fonts/inter/inter.ttf');

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('inter', {}, new Uint8Array(readFileSync(TTF)).buffer);
  await loadFontOutlines('inter');
});

it('paints the glyphs the README example lays out', () => {
  // As in README.md's "Usage".
  const style = resolveTextStyle({ fontFamily: 'inter', fontSize: 64 }, { fill: DEFAULT_TEXT_FILL });
  const runs = resolveRuns(toRuns('Hello'), style);
  const laid = layoutRuns(runs, { maxWidth: 900, lineHeight: 1.2, align: 'center' });
  const { groups } = paintRuns(laid, runs);

  expect(laid.lines).toHaveLength(1);
  expect(groups.flatMap((g) => g.glyphs ?? [])).toHaveLength(5);
});
