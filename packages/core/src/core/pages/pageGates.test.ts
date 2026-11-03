import { describe, expect, it } from 'vitest';
import type { DrawCommand } from '@weasel-js/renderer';
import { boundsOfPath, pathContainsPoint, type Path } from '@weasel-js/geom';
import { sceneFromJSON } from '../scene/scene';
import { asNodeId, type RectPose } from '../scene/types';
import { nodeGates } from '../scene/nodeGates';
import { buildSceneTree } from '../../canvas/buildSceneTree';
import { pickWalk, scenePickSource } from '../../canvas/pickWalk';
import { sceneToAdapter } from '../../canvas/sceneAdapter';
import { doubleClickTarget } from '../../canvas/doubleClickTarget';
import { pressTarget } from '../../tools/builtin/pressTarget';
import { placedPagesOf } from './pageNodes';
import { pagesLayer } from './pagesLayer';
import { PAGE_CLIP } from './pageClip';
import { ON_PAGE as R, PAGE_A as A, PAGE_B as B, pagedScene } from './pagedFixture';

describe('page and run nodes are out of the ordinary tools\' reach', () => {
  it('are unpickable, and say so through the gates', () => {
    const { scene, run } = pagedScene();
    const gates = nodeGates(scene);
    for (const id of [run, A, B]) {
      expect(scene.get(id)!.pickable).toBe(false);
      expect(gates.structure(id)).toBe(true);
    }
    expect(gates.structure(R)).toBe(false);
  });

  it('the scene\'s own selection never holds a page or the run', () => {
    const { scene, run } = pagedScene();
    scene.setSelection([A, run, R]);
    expect(scene.getSelection()).toEqual([R]);
  });

  it('a pick on empty paper finds nothing, and one on the content finds it', () => {
    const { scene } = pagedScene();
    const at = (x: number, y: number) => pickWalk<RectPose>(scenePickSource(scene), {
      hits: (_n, p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height,
      clipAdmits: (clip) => pathContainsPoint(clip, x, y),
    });
    expect(at(20, 20)).toEqual([]);
    expect(at(95, 15)).toEqual([R]);
    // The overhang, in the gap between the pages, is clipped away.
    expect(at(105, 15)).toEqual([]);
  });

  it('a press or a double-click on content names the content, not the page or run above it', () => {
    const { scene } = pagedScene();
    const getParent = (id: string) => scene.get(asNodeId(id))?.parent ?? null;
    const getNode = (id: string) => scene.get(asNodeId(id));
    expect(pressTarget({ getParent, getNode }, R, null)).toBe(R);
    expect(doubleClickTarget(R, { parentOf: getParent, kindOf: () => 'group', scope: null, getNode })).toBe(R);
  });
});

describe('a page clips what is on it', () => {
  type Group = { kind: 'group'; clip?: Path; children: DrawCommand[] };
  const draw = (): DrawCommand[] => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }];

  it('wraps content overhanging the page in the page\'s clip, from a layer above the page\'s', () => {
    const { scene } = pagedScene();
    const layers = buildSceneTree(sceneToAdapter(scene) as never, draw as never, { x: 0, y: 0, scale: { x: 1, y: 1 } }) as Group[];
    const ink = layers[1]!;
    const clip = (ink.children.at(-1) as Group).clip;
    expect(clip && boundsOfPath(clip)).toMatchObject({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('saves the clip under its kit key and loads it back with no consumer registry', () => {
    const { scene } = pagedScene();
    const json = JSON.parse(JSON.stringify(scene.toJSON()));
    expect(json.nodes.find((n: { id: string }) => n.id === A).clipFromPoseKey).toBe(PAGE_CLIP);
    const reloaded = sceneFromJSON<object, 'paper' | 'ink', RectPose>(json, {});
    expect(reloaded.get(A)!.clipFromPose).toBe(scene.get(A)!.clipFromPose);
    expect(reloaded.get(A)!.pickable).toBe(false);
  });
});

describe('the paper', () => {
  it('hiding the content layer leaves the paper as it was', () => {
    const { scene } = pagedScene();
    const paper = () => pagesLayer(placedPagesOf(scene), { fill: '#fff' }).draw(undefined, {} as never, {} as never);
    const before = paper();
    scene.setLayerVisible('ink', false);
    expect(paper()).toEqual(before);
    expect(before).toHaveLength(2);
  });
});
