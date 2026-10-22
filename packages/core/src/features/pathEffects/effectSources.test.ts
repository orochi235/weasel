import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import type { PathEffect } from 'core/scene/pathEffects/effects';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { effectSourceFor } from './effectSources';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from './index';

const T = asNodeId('t');
const P = asNodeId('p');
const Q = asNodeId('q');
const S = asNodeId('s');
const FX = asNodeId('fx');
const BOX = { x: 0, y: 0, width: 100, height: 20 };
const line = { path: pathFromD('M0 50 L100 50') };

function sceneWith(effect: PathEffect, sources: string[]) {
  return createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withPathEffectsRegistry(),
    initial: [
      { id: T, kind: 'leaf', layer: 'main', pose: BOX, data: { text: 'Hi', style: { fontSize: 16 } } },
      { id: P, kind: 'leaf', layer: 'main', pose: BOX, data: line },
      { id: Q, kind: 'leaf', layer: 'main', pose: BOX, data: line },
      { id: S, kind: 'leaf', layer: 'main', pose: BOX, data: line },
      { ...pathEffectNode(effect, sources.map(asNodeId), 'main', PATH_EFFECT_DERIVATIONS), id: FX },
    ],
  });
}

describe('effectSourceFor', () => {
  it("answers a text-along node's text and path", () => {
    const scene = sceneWith({ kind: 'textAlong', hideSources: true }, ['t', 'p']);
    expect(effectSourceFor(scene, FX, 'text')).toBe(T);
    expect(effectSourceFor(scene, FX, 'path')).toBe(P);
  });

  it('answers the path of every along kind, and no text where the shape is not text', () => {
    for (const kind of ['bendAlong', 'repeatAlong'] as const) {
      const scene = sceneWith({ kind, hideSources: true } as PathEffect, ['q', 'p']);
      expect(effectSourceFor(scene, FX, 'path')).toBe(P);
      expect(effectSourceFor(scene, FX, 'text')).toBeNull();
    }
  });

  it("answers a blend's spine as its path, and none without one", () => {
    expect(effectSourceFor(sceneWith({ kind: 'blend', steps: 3, hideSources: true } as PathEffect, ['q', 's', 'p']), FX, 'path')).toBe(P);
    expect(effectSourceFor(sceneWith({ kind: 'blend', steps: 3, hideSources: true } as PathEffect, ['q', 's']), FX, 'path')).toBeNull();
  });

  it('answers nothing for an effect showing its sources, or a node that is no effect', () => {
    const shown = sceneWith({ kind: 'textAlong' }, ['t', 'p']);
    expect(effectSourceFor(shown, FX, 'text')).toBeNull();
    expect(effectSourceFor(shown, FX, 'path')).toBeNull();
    expect(effectSourceFor(shown, T, 'text')).toBeNull();
    expect(effectSourceFor(shown, asNodeId('missing'), 'path')).toBeNull();
  });
});
