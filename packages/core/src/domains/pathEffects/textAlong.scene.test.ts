/**
 * A `textAlong` node in a scene over a text node: while its face's outlines are still loading it paints nothing until
 * they land, then paints the text along its path without anything else changing; and it lays out the text its source
 * shows, which a data override can say without touching the document.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD } from '@weasel-js/geom';
import { loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { sceneDerivedPathOf } from 'canvas/derivedPath';
import { derivedPartsOf } from 'core/scene/derivedParts';
import { documentPose, effectivePose } from 'core/scene/effectivePose';
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

function setup() {
  registerFontOutlines('late', {}, new ArrayBuffer(4), { parser: () => BARS });
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 400, height: 120 }, data: TEXT },
      { id: P, kind: 'mark', layer: 'main', pose: { x: 0, y: 200, width: 400, height: 1 }, data: { path: pathFromD('M0 200 L400 200') } },
      { ...pathEffectNode({ kind: 'textAlong' }, [T, P], 'main', PATH_EFFECT_DERIVATIONS), id: FX },
    ],
  });
}

describe('a textAlong node over text whose outlines are loading', () => {
  it('paints nothing until they land, then paints the text', async () => {
    const scene = setup();
    const pathOf = sceneDerivedPathOf(scene);
    expect(pathOf(scene.get(FX)!)).toBeNull();

    await loadTextOutlines(TEXT);

    const parts = derivedPartsOf(pathOf(scene.get(FX)!));
    expect(parts).toHaveLength(2);
  });
});

describe('a textAlong node over text a data override shows', () => {
  const shownText = (text: string) => (d: unknown) => ({ ...(d as TextOutlineSource), text });

  it('lays out the shown text, and the stored text again once the override is cleared', async () => {
    const scene = setup();
    await loadTextOutlines(TEXT);
    const pathOf = sceneDerivedPathOf(scene);
    scene.overrides.set(T, { data: shownText('Hi!') });
    expect(derivedPartsOf(pathOf(scene.get(FX)!))).toHaveLength(3);
    expect((scene.get(T)!.data as TextOutlineSource).text).toBe('Hi');
    scene.overrides.clear(T);
    expect(derivedPartsOf(pathOf(scene.get(FX)!))).toHaveLength(2);
  });

  it('follows each replacement of the override', async () => {
    const scene = setup();
    await loadTextOutlines(TEXT);
    const pathOf = sceneDerivedPathOf(scene);
    const entry: { data?: (d: unknown) => unknown } = { data: shownText('Hi!') };
    scene.overrides.set(T, entry);
    expect(derivedPartsOf(pathOf(scene.get(FX)!))).toHaveLength(3);
    entry.data = shownText('Hi!!');
    scene.overrides.commit();
    expect(derivedPartsOf(pathOf(scene.get(FX)!))).toHaveLength(4);
  });

  it('boxes itself from the shown text, while the document reading keeps the stored text', async () => {
    const scene = setup();
    await loadTextOutlines(TEXT);
    const before = effectivePose(scene, scene.get(FX)!);
    scene.overrides.set(T, { data: shownText('Hi!!!!') });
    expect(effectivePose(scene, scene.get(FX)!).width).toBeGreaterThan(before.width);
    expect(documentPose(scene, scene.get(FX)!)).toEqual(before);
  });
});
