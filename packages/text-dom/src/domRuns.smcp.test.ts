import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { glyphOutline, registerFontOutlines, type FaceEmbedding } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { registerShaper, resolveRuns, resolveTextStyle, type TextShaper } from '@weasel-js/text';
import { domToRuns, normalizeSmallCaps, runsToDom } from './domRuns';

/** A face with sfnt bytes, and a shaper that finds `smcp` in it: the canvas draws its small caps from the
 *  face's own glyphs, so the overlay must not draw synthesized ones over them. */
const SFNT = new ArrayBuffer(8);

function registerCapsFace(family: string): void {
  registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
    parser: () => ({
      unitsPerEm: 1000,
      ascender: 0.8,
      advanceOf: () => 0.5,
      kernOf: () => 0,
      glyphD: () => 'M0 0Z',
      embedding: () => ({ sfnt: SFNT } as unknown as FaceEmbedding),
    }),
  });
}

const shaper: TextShaper = {
  shape: () => [],
  glyphD: () => '',
  hasFeature: (_face, tag) => tag === 'smcp',
} as unknown as TextShaper;

describe('domRuns — small caps a face draws itself', () => {
  let unregister: (() => void) | null = null;
  beforeEach(async () => {
    _resetFontRegistryForTests();
    registerCapsFace('caps');
    glyphOutline('caps', 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
    unregister = registerShaper(shaper);
  });
  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it('writes the run as its text, for the face to set in its own small capitals as the canvas does', () => {
    const base = resolveTextStyle({ fontFamily: 'caps' });
    const runs = [{ text: 'Ab', fontVariantCaps: 'small-caps' as const }];
    // The canvas side: no synthesis, the face's `smcp` turned on.
    expect(resolveRuns(runs, base)[0]).toMatchObject({ text: 'Ab', fontFeatures: ['smcp'] });

    const parent = document.createElement('div');
    runsToDom(runs, parent, base);
    expect(parent.querySelector('[data-small-caps]')).toBeNull();
    expect(parent.textContent).toBe('Ab');
    expect(normalizeSmallCaps(parent, base)).toBe(false);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('takes apart pieces a synthesizing face left once the run is set in one with its own', () => {
    const base = resolveTextStyle({ fontFamily: 'caps' });
    const parent = document.createElement('div');
    runsToDom([{ text: 'Ab', fontVariantCaps: 'small-caps', fontFamily: 'plain' }], parent, base);
    expect(parent.querySelector('[data-small-caps]')).not.toBeNull();
    parent.querySelector<HTMLElement>('[data-run]')!.setAttribute('data-font-family', 'caps');
    expect(normalizeSmallCaps(parent, base)).toBe(true);
    expect(parent.querySelector('[data-small-caps]')).toBeNull();
    expect(parent.textContent).toBe('Ab');
  });
});
