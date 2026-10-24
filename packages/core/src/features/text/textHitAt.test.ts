/**
 * `textHitAt` over a text-along node hiding its text: the curved glyphs answer for the hidden text, and the text's own
 * box does not. The face draws each glyph as a bar 20 wide and 50 tall on a 60 advance, so where the glyphs are is
 * worked out by hand.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD } from '@weasel-js/geom';
import { isTextData, loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from '../pathEffects';
import { textHitAt, type TextReads } from './textHitAt';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const T = asNodeId('t');
const P = asNodeId('p');
const FX = asNodeId('fx');
const TEXT: TextOutlineSource = {
  text: 'Hi', style: { fontFamily: 'bars', fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#000' } },
};
const READ: TextReads<unknown> = {
  isText: isTextData,
  text: (d) => (d as { text: string }).text,
  style: (d) => (d as TextOutlineSource).style,
  runs: () => undefined,
  verticalAlign: () => undefined,
  padding: () => undefined,
};

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

/** Each glyph a bar with a hole through it, as an O or the bowl of a d has. */
const RINGS: OutlineFace = { ...BARS, glyphD: () => `${BARS.glyphD(0)} M0.05 -0.45L0.05 -0.05L0.15 -0.05L0.15 -0.45Z` };

async function curved(hideSources: boolean, face = BARS) {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => face });
  await loadTextOutlines(TEXT);
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 400, height: 120 }, data: TEXT, hidden: hideSources },
      { id: P, kind: 'mark', layer: 'main', pose: { x: 0, y: 300, width: 400, height: 1 }, data: { path: pathFromD('M0 300 L400 300') }, hidden: hideSources },
      { ...pathEffectNode({ kind: 'textAlong', hideSources }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
    ],
  });
}

describe('textHitAt over a text-along node', () => {
  it('answers the hidden text, caret at its end, where the curved glyphs are', async () => {
    const scene = await curved(true);
    expect(textHitAt(scene, READ, 10, 280)).toEqual({ id: 't', caret: 2 });
    expect(textHitAt(scene, READ, 70, 280)).toEqual({ id: 't', caret: 2 });
  });

  it("answers nothing between the glyphs, or on the hidden text's own box", async () => {
    const scene = await curved(true);
    expect(textHitAt(scene, READ, 40, 280)).toBeNull();
    expect(textHitAt(scene, READ, 50, 60)).toBeNull();
  });

  it("answers in a glyph's counter too, not only on its ink", async () => {
    const scene = await curved(true, RINGS);
    expect(textHitAt(scene, READ, 10, 280)).toEqual({ id: 't', caret: 2 });
    expect(textHitAt(scene, READ, 40, 280)).toBeNull();
  });

  it('answers the glyphs an open edit shows, caret at the end of the shown text', async () => {
    const scene = await curved(true);
    expect(textHitAt(scene, READ, 130, 280)).toBeNull();
    scene.overrides.set(T, { data: (d) => ({ ...(d as TextOutlineSource), text: 'Hi!!!' }) });
    expect(textHitAt(scene, READ, 130, 280)).toEqual({ id: 't', caret: 5 });
  });

  it('leaves an effect showing its sources alone', async () => {
    const scene = await curved(false);
    expect(textHitAt(scene, READ, 10, 280)).toBeNull();
  });
});
