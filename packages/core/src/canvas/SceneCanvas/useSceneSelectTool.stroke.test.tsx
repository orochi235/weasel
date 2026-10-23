/**
 * The chrome's bounds source includes a node's stroke as drawn, unless the
 * canvas opts back down to the pose's geometry.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import type { RectPose, UseSceneOptions } from 'core/scene/types';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { asNodeId } from 'core/scene/types';
import { useSceneSelectTool } from './useSceneSelectTool';

const initial: UseSceneOptions<object, 'default', RectPose>['initial'] = [
  {
    id: asNodeId('n'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#000' }, width: 10 } },
  },
  {
    id: asNodeId('px'), kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { shape: 'rect', stroke: { paint: { kind: 'solid', color: '#000' }, width: { px: 8 } } },
  },
];

function render(boundsIncludeStroke?: boolean, scale: number | { x: number; y: number } = 1) {
  const s = typeof scale === 'number' ? { x: scale, y: scale } : scale;
  return renderHook(() => {
    const scene = useScene<object, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial });
    const adapter = useSceneAdapter(scene);
    return useSceneSelectTool({
      scene, adapter, getView: () => ({ x: 0, y: 0, scale: s }),
      ...(boundsIncludeStroke === undefined ? {} : { geometry: { boundsIncludeStroke } }),
    });
  }).result;
}

describe('chrome bounds of a stroked node', () => {
  it('include the stroke by default', () => {
    expect(render().current.boundsOf('n')).toEqual({ x: -5, y: -5, width: 110, height: 110 });
  });

  it('resolve a screen-pixel stroke at the view scale', () => {
    expect(render(undefined, 4).current.boundsOf('px')).toEqual({ x: -1, y: -1, width: 102, height: 102 });
  });

  it('resolve a screen-pixel stroke per axis under a stretched view', () => {
    expect(render(undefined, { x: 4, y: 1 }).current.boundsOf('px')).toEqual({ x: -1, y: -4, width: 102, height: 108 });
  });

  it('are the pose box under boundsIncludeStroke: false', () => {
    expect(render(false).current.boundsOf('n')).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });
});
