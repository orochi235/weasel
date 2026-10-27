import { describe, expect, it } from 'vitest';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { composeSelectionPose, createSelectionOverlayLayer } from './overlay';

const RED = { kind: 'solid', color: '#f00' } as const;
const DIMS = { width: 400, height: 400, dpr: 1 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function sceneOf() {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.add({ id: asNodeId('g'), kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 } } as never);
  scene.add({
    id: asNodeId('a'), kind: 'mark', layer: 'main', parent: asNodeId('g'),
    data: { shape: 'rect', stroke: { paint: RED, width: 10 } }, pose: { x: 0, y: 0, width: 100, height: 100 },
  } as never);
  scene.add({
    id: asNodeId('px'), kind: 'mark', layer: 'main',
    data: { shape: 'rect', stroke: { paint: RED, width: { px: 8 } } }, pose: { x: 0, y: 0, width: 100, height: 100 },
  } as never);
  return scene;
}

function outlineRect(cmds: readonly unknown[]) {
  const path = (cmds[0] as PathDrawCommand).path as { x: number; y: number; width: number; height: number };
  return { x: path.x, y: path.y, width: path.width, height: path.height };
}

describe('selection chrome on the drawn box', () => {
  it('outlines a stroked node on its stroke when the overlay is handed the scene', () => {
    const scene = sceneOf();
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('a')],
      getPose: (id) => scene.get(asNodeId(id))!.pose,
      scene,
      handles: false,
      outline: { paint: RED, width: 0, pad: 0 },
    });
    expect(outlineRect(layer.draw(undefined, VIEW, DIMS))).toEqual({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('resolves a screen-pixel stroke at the view the overlay draws under', () => {
    const scene = sceneOf();
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('px')],
      getPose: (id) => scene.get(asNodeId(id))!.pose,
      scene,
      handles: false,
      outline: { paint: RED, width: 0, pad: 0 },
    });
    // 4 screen px past the edge, at scale 2: 2 world units, 4 on screen.
    expect(outlineRect(layer.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, DIMS)))
      .toEqual({ x: -4, y: -4, width: 208, height: 208 });
  });

  it('boxes a container around its members as drawn', () => {
    const scene = sceneOf();
    const resolve = composeSelectionPose<RectPose>({
      getStoredPose: (id) => scene.get(asNodeId(id))!.pose,
      getChildren: (id) => scene.childrenOf(asNodeId(id)),
      isContainer: (id) => scene.get(asNodeId(id))?.kind === 'group',
      scene,
    });
    expect(resolve('g')).toEqual({ x: -5, y: -5, width: 110, height: 110 });
    // A leaf still resolves to its pose: the overlay outsets it.
    expect(resolve('a')).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('unions a container\'s members as drawn in the overlay', () => {
    const scene = sceneOf();
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('g')],
      getPose: (id) => scene.get(asNodeId(id))!.pose,
      getChildren: (id) => scene.childrenOf(asNodeId(id)),
      isContainer: (id) => scene.get(asNodeId(id))?.kind === 'group',
      scene,
      handles: false,
      outline: { paint: RED, width: 0, pad: 0 },
    });
    expect(outlineRect(layer.draw(undefined, VIEW, DIMS))).toEqual({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('keeps the pose box with no scene', () => {
    const scene = sceneOf();
    const layer = createSelectionOverlayLayer<RectPose>({
      getSelection: () => [asNodeId('a')],
      getPose: (id) => scene.get(asNodeId(id))!.pose,
      handles: false,
      outline: { paint: RED, width: 0, pad: 0 },
    });
    expect(outlineRect(layer.draw(undefined, VIEW, DIMS))).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
