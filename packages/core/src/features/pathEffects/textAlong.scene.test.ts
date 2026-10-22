/**
 * A `textAlong` node in a scene over a text node whose face's outlines are still loading: it paints nothing until they
 * land, then paints the text along its path without anything else changing.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD } from '@weasel-js/geom';
import { loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { sceneDerivedPathOf } from 'canvas/derivedPath';
import { derivedPartsOf } from 'core/scene/derivedParts';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const T = asNodeId('t');
const P = asNodeId('p');
const FX = asNodeId('fx');
const TEXT: TextOutlineSource = {
  text: 'Hi', style: { fontFamily: 'late', fontSize: 100 }, fill: { paint: { kind: 'solid', color: '#000' } },
};

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

describe('a textAlong node over text whose outlines are loading', () => {
  it('paints nothing until they land, then paints the text', async () => {
    registerFontOutlines('late', {}, new ArrayBuffer(4), { parser: () => BARS });
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withPathEffectsRegistry(),
      initial: [
        { id: T, kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 400, height: 120 }, data: TEXT },
        { id: P, kind: 'leaf', layer: 'main', pose: { x: 0, y: 200, width: 400, height: 1 }, data: { path: pathFromD('M0 200 L400 200') } },
        { ...pathEffectNode({ kind: 'textAlong' }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
      ],
    });
    const pathOf = sceneDerivedPathOf(scene);
    expect(pathOf(scene.get(FX)!)).toBeNull();

    await loadTextOutlines(TEXT);

    const parts = derivedPartsOf(pathOf(scene.get(FX)!));
    expect(parts).toHaveLength(2);
  });
});
