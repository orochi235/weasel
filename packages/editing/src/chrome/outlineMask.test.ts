import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import { pathContainsPoint, type Path } from '@weasel-js/geom';
import { createScene, asNodeId, type RectPose } from '@weasel-js/core/engine';
import type { DrawnBoundsScene } from '@weasel-js/core';
import { createSelectionOverlayLayer } from './overlay';
import { occludersOf, type MaskReads } from './outlineMask';

const FILL = { fill: { paint: { kind: 'solid', color: '#f00' } } } as const;
const DIMS = { width: 400, height: 400, dpr: 1 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function sceneOf() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const mark = (id: string, pose: RectPose, extra: object = {}) => scene.add({
    id: asNodeId(id), kind: 'mark', layer: 'main', data: { shape: 'rect', ...FILL }, pose, ...extra,
  } as never);
  mark('below', { x: 80, y: 0, width: 60, height: 60 });
  mark('a', { x: 0, y: 0, width: 100, height: 60 });
  mark('label', { x: 90, y: 10, width: 40, height: 20 }, { parent: asNodeId('a'), pickable: false });
  mark('front', { x: 80, y: 20, width: 60, height: 60 });
  mark('far', { x: 300, y: 300, width: 20, height: 20 });
  mark('ghost', { x: -20, y: -20, width: 40, height: 40 }, { hidden: true });
  return scene;
}

function layerFor(scene: ReturnType<typeof sceneOf>, ids: string[], mask = true) {
  return createSelectionOverlayLayer<RectPose>({
    getSelection: () => ids.map(asNodeId),
    getPose: (id) => scene.get(asNodeId(id))!.pose,
    scene,
    handles: false,
    outline: { width: 2, follow: 'shape', mask },
  });
}

const groups = (cmds: readonly DrawCommand[]) => cmds.filter((c): c is GroupDrawCommand => c.kind === 'group');
const clipOf = (cmds: readonly DrawCommand[]): Path | undefined => groups(cmds).find((g) => g.clip)?.clip;

function readsOf(scene: ReturnType<typeof sceneOf>): MaskReads {
  return {
    scene: scene as unknown as MaskReads['scene'],
    poseOf: (id) => scene.get(asNodeId(id))?.pose,
    inFlight: () => false,
  };
}

describe('outline mask occluders', () => {
  it('takes the nodes painted after the outlined one, less its own subtree and hidden nodes', () => {
    const scene = sceneOf();
    const area = { x: -50, y: -50, width: 500, height: 500 };
    expect(occludersOf('a', area, readsOf(scene), 1, new Map()).ids).toEqual(['front', 'far']);
  });

  it('keeps only those whose ink meets the area', () => {
    const scene = sceneOf();
    const area = { x: -3, y: -3, width: 106, height: 66 };
    expect(occludersOf('a', area, readsOf(scene), 1, new Map()).ids).toEqual(['front']);
  });

  it('skips layers the view does not paint', () => {
    const scene = sceneOf();
    const area = { x: -3, y: -3, width: 106, height: 66 };
    const reads = { ...readsOf(scene), paints: () => false };
    expect(occludersOf('a', area, reads, 1, new Map()).ids).toEqual([]);
  });

  it('nothing in front: the topmost node gets no occluders', () => {
    const scene = sceneOf();
    const area = { x: 0, y: 0, width: 1000, height: 1000 };
    expect(occludersOf('ghost', area, readsOf(scene), 1, new Map()).ids).toEqual([]);
  });
});

describe('outline.mask on the selection layer', () => {
  it('clips the outline to outside what paints in front of it', () => {
    const scene = sceneOf();
    const clip = clipOf(layerFor(scene, ['a']).draw(undefined, VIEW, DIMS))!;
    expect(clip.kind).toBe('polygon');
    expect(clip.kind === 'polygon' && clip.fillRule).toBe('evenodd');
    // Inside `front`, which paints after `a`.
    expect(pathContainsPoint(clip, 101, 50)).toBe(false);
    // On `a`'s outline, clear of `front`; and inside `below`, which paints before it.
    expect(pathContainsPoint(clip, 50, -1)).toBe(true);
    expect(pathContainsPoint(clip, 101, 10)).toBe(true);
  });

  it('draws an uncovered outline with no clip', () => {
    const scene = sceneOf();
    const cmds = layerFor(scene, ['front']).draw(undefined, VIEW, DIMS);
    expect(groups(cmds)).toHaveLength(1);
    expect(clipOf(cmds)).toBeUndefined();
  });

  it('draws no clip with mask off', () => {
    const scene = sceneOf();
    expect(clipOf(layerFor(scene, ['a'], false).draw(undefined, VIEW, DIMS))).toBeUndefined();
  });

  it('keeps the clip until the scene changes', () => {
    const scene = sceneOf();
    const layer = layerFor(scene, ['a']);
    const first = clipOf(layer.draw(undefined, VIEW, DIMS));
    expect(clipOf(layer.draw(undefined, { x: 5, y: 0, scale: { x: 1, y: 1 } }, DIMS))).toBe(first);
    scene.setPose(asNodeId('front'), { x: 200, y: 200, width: 60, height: 60 });
    expect(clipOf(layer.draw(undefined, VIEW, DIMS))).toBeUndefined();
    scene.setPose(asNodeId('front'), { x: 80, y: 20, width: 60, height: 60 });
    const back = clipOf(layer.draw(undefined, VIEW, DIMS));
    expect(back).toBeDefined();
    expect(back).not.toBe(first);
  });

  it('refuses mask without a shape to follow, or a scene with no paint order', () => {
    const scene = sceneOf();
    const base = { getSelection: () => [asNodeId('a')], handles: false as const };
    expect(() => createSelectionOverlayLayer({ ...base, scene, outline: { mask: true } }))
      .toThrow(/follow: 'shape'/);
    const bare: DrawnBoundsScene = { get: (id) => scene.get(id) as never };
    expect(() => createSelectionOverlayLayer({ ...base, shapes: bare, outline: { follow: 'shape', mask: true } }))
      .toThrow(/renderOrderNodes/);
  });
});
