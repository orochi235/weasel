/**
 * A WeaselDraw document holding a live blend, through the session save and a
 * reload: the scene `App` builds, `toJSON` as `useSessionPersistence` writes
 * it, and `nodeSpecsFromSnapshot` as `loadInitial` reads it back.
 */
import { describe, expect, it } from 'vitest';
import {
  asNodeId, createScene, derivedDepOf, PATH_EFFECT_DERIVATIONS, pathEffectNode, pathEffectParts, rectPath,
  type AddNodeSpec, type NodeId, type SerializedScene, solid,
} from '@weasel-js/core';
import { DRAW_REGISTRY, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { nodeSpecsFromSnapshot, reviveSnapshot, serializeReplacer } from './persistence';
import { sceneToSvgString } from './svgExport';

type Spec = AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;

const box = (id: string, x: number, color: string): Spec => ({
  kind: 'leaf',
  id: asNodeId(id),
  layer: 'default',
  pose: { x, y: 0, width: 40, height: 40 },
  data: { path: rectPath(0, 0, 40, 40), fill: { paint: solid(color) } },
});

const drawScene = (initial: Spec[]) =>
  createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({
    systemLayers: [{ id: 'default' }],
    registry: DRAW_REGISTRY,
    initial,
  });

function steps(scene: ReturnType<typeof drawScene>) {
  const blend = scene.get(asNodeId('blend'))!;
  const deps = (blend.dependsOn as NodeId[]).map((id) => derivedDepOf(scene, id));
  return pathEffectParts(blend, deps) ?? [];
}

const withBlend = () => drawScene([
  box('a', 0, '#ff0000'),
  {
    ...pathEffectNode({ kind: 'blend', steps: 3 }, [asNodeId('a'), asNodeId('b')], 'default', PATH_EFFECT_DERIVATIONS),
    id: asNodeId('blend'),
  } as Spec,
  box('b', 300, '#0000ff'),
]);

describe('a draw document with a blend', () => {
  it('saves and reopens with the blend still live', () => {
    const scene = withBlend();
    expect(steps(scene)).toHaveLength(3);

    const saved = JSON.stringify(scene.toJSON(), serializeReplacer);
    const json = reviveSnapshot(JSON.parse(saved)) as SerializedScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>;
    const reopened = drawScene(nodeSpecsFromSnapshot(json, DRAW_REGISTRY));

    expect(steps(reopened)).toHaveLength(3);
    // Still derived: moving a source moves the steps.
    reopened.setPose(asNodeId('b'), { x: 300, y: 200, width: 40, height: 40 });
    expect(steps(reopened)[2]!.path).not.toEqual(steps(scene)[2]!.path);
  });

  it('exports what the blend shows, its steps as ordinary paths in their own paint', async () => {
    const warnings: string[] = [];
    const svg = await sceneToSvgString(withBlend(), {
      filename: 'x.svg', paperSize: 'letter' as never, paperWidth: 400, paperHeight: 300,
      backgroundColor: '#ffffff', onWarn: (m) => warnings.push(m),
    });
    // Two sources and three steps.
    expect(svg.match(/<path\b/g)).toHaveLength(5);
    // The steps' colors run between the sources' red and blue.
    const fills = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) => m[1]!.toLowerCase());
    expect(new Set(fills).size).toBe(5);
    expect(warnings).toEqual([]);
  });
});
