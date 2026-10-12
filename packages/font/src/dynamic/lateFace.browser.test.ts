/**
 * A canvas draws a family it has not loaded yet in a fallback face, and says
 * nothing when the real one arrives. jsdom has neither fonts nor a canvas, so
 * both halves are measured in a real engine: that the first advance is the
 * fallback's, and that the face the tier holds follows the load.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  registerCanvasFont, getDynamicFace, refreshCanvasFont, _resetDynamicFontsForTests,
} from './dynamicAtlas';
import { subscribeGlyphReady } from '../glyphReady';
import { BAKE_SIZE } from './glyphRasterizer';
import ttfUrl from '../../../../assets/fonts/inter/inter.ttf?url';

const W = 'W'.codePointAt(0)!;

function canvasAdvance(family: string): number {
  const ctx = new OffscreenCanvas(1, 1).getContext('2d')!;
  ctx.font = `400 ${BAKE_SIZE}px "${family}"`;
  return ctx.measureText('W').width;
}

const added: FontFace[] = [];
afterEach(() => {
  for (const face of added.splice(0)) document.fonts.delete(face);
  _resetDynamicFontsForTests();
});

describe('a web font that loads after the canvas tier first drew its family', () => {
  it('replaces the fallback face, once the document reports the load', async () => {
    const family = 'weasel-late-face-event';
    registerCanvasFont(family);
    const fallback = getDynamicFace(family, 400, 'normal').requestGlyph(W).xadvance;

    const ready = new Promise<void>((resolve) => { subscribeGlyphReady(resolve); });
    const face = new FontFace(family, `url(${ttfUrl})`);
    added.push(face);
    document.fonts.add(face);
    await face.load();
    await ready;

    const loaded = canvasAdvance(family);
    expect(Math.abs(loaded - fallback), 'the fallback is a different face').toBeGreaterThan(1);
    expect(getDynamicFace(family, 400, 'normal').requestGlyph(W).xadvance).toBeCloseTo(loaded, 3);
  });

  it('replaces it on `refreshCanvasFont`, for a face the document never reported', async () => {
    const family = 'weasel-late-face-asked';
    registerCanvasFont(family);
    const held = getDynamicFace(family, 400, 'normal');
    const fallback = held.requestGlyph(W).xadvance;

    // Loaded before it joins the set, so the set announces nothing.
    const face = new FontFace(family, `url(${ttfUrl})`);
    await face.load();
    added.push(face);
    document.fonts.add(face);
    expect(held.requestGlyph(W).xadvance).toBe(fallback);

    refreshCanvasFont(family);
    expect(held.requestGlyph(W).xadvance).toBeCloseTo(canvasAdvance(family), 3);
  });
});
