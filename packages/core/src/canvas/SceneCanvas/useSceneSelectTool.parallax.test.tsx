/**
 * Picking and selection chrome for nodes on a parallax scene layer: a click
 * resolves against where the plane paints the node, not where its pose says.
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useScene } from 'core/scene/useScene';
import { asNodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { useSceneAdapter } from 'canvas/useSceneAdapter';
import { useSceneSelectTool } from './useSceneSelectTool';

type Pose = { x: number; y: number; width: number; height: number };

// Camera scrolled 400 right. The backdrop follows at a quarter of that, so it
// has slid only 100: a node stored at x=0 paints under camera-world x=300.
const CAMERA: View = { x: 400, y: 0, scale: { x: 1, y: 1 } };

function harness(camera: View = CAMERA) {
  const { result } = renderHook(() => {
    const scene = useScene<unknown, 'back' | 'main', Pose>({
      systemLayers: [{ id: 'back', parallax: { pan: 0.25 } }, { id: 'main' }],
      initial: [
        { id: asNodeId('hill'), kind: 'mark', layer: 'back', pose: { x: 0, y: 0, width: 50, height: 50 }, data: {} },
        { id: asNodeId('crate'), kind: 'mark', layer: 'main', pose: { x: 300, y: 100, width: 20, height: 20 }, data: {} },
      ],
    });
    const adapter = useSceneAdapter(scene);
    return useSceneSelectTool({ scene, adapter, getView: () => camera });
  });
  return result;
}

describe('useSceneSelectTool — parallax layers', () => {
  it('picks a plane node where it is painted', () => {
    const r = harness();
    expect(r.current.pickEvery({ x: 310, y: 10 })).toEqual(['hill']);
  });

  it('does not pick a plane node where its pose sits in the camera world', () => {
    const r = harness();
    expect(r.current.pickEvery({ x: 10, y: 10 })).toEqual([]);
  });

  it('leaves nodes on camera-locked layers where they were', () => {
    const r = harness();
    expect(r.current.pickEvery({ x: 305, y: 105 })).toEqual(['crate']);
  });

  it('picks for the camera the caller names over the surface one', () => {
    const r = harness();
    // At the origin camera the plane has not moved at all.
    expect(r.current.pickEvery({ x: 10, y: 10 }, { x: 0, y: 0, scale: { x: 1, y: 1 } })).toEqual(['hill']);
  });

  it('reports a plane node\'s bounds in the camera world, so chrome lands on the ink', () => {
    const r = harness();
    expect(r.current.boundsOf('hill')).toEqual({ x: 300, y: 0, width: 50, height: 50 });
    expect(r.current.boundsOf('crate')).toEqual({ x: 300, y: 100, width: 20, height: 20 });
  });

  it('scales a plane that zooms slower than the camera', () => {
    // Camera at 2x; the plane does not zoom at all, so its content reads half
    // as large in camera units, pinned at the anchor.
    const { result } = renderHook(() => {
      const scene = useScene<unknown, 'back', Pose>({
        systemLayers: [{ id: 'back', parallax: { pan: 1, zoom: 0 } }],
        initial: [{ id: asNodeId('sun'), kind: 'mark', layer: 'back', pose: { x: 0, y: 0, width: 40, height: 40 }, data: {} }],
      });
      const adapter = useSceneAdapter(scene);
      return useSceneSelectTool({ scene, adapter, getView: () => ({ x: 0, y: 0, scale: { x: 2, y: 2 } }) });
    });
    expect(result.current.boundsOf('sun')).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(result.current.pickEvery({ x: 15, y: 15 })).toEqual(['sun']);
    expect(result.current.pickEvery({ x: 30, y: 30 })).toEqual([]);
  });

  it('picks a container and its child through the plane', () => {
    const { result } = renderHook(() => {
      const scene = useScene<unknown, 'trees', Pose>({
        systemLayers: [{ id: 'trees', parallax: { pan: 1.3 } }],
        initial: [
          { id: asNodeId('tree'), kind: 'group', layer: 'trees', pose: { x: 400, y: 300, width: 30, height: 50 }, data: { fill: null } },
          { id: asNodeId('trunk'), kind: 'mark', layer: 'trees', parent: asNodeId('tree'), pose: { x: 10, y: 30, width: 10, height: 20 }, data: {} },
        ],
      });
      const adapter = useSceneAdapter(scene);
      return useSceneSelectTool({ scene, adapter, getView: () => ({ x: 100, y: 0, scale: { x: 1, y: 1 } }) });
    });
    // The plane has moved 130 to the camera's 100: the trunk paints at 380..390.
    expect(result.current.pickEvery({ x: 385, y: 340 })).toEqual(['tree', 'trunk']);
    expect(result.current.pickEvery({ x: 415, y: 340 })).toEqual([]);
    expect(result.current.boundsOf('tree')).toEqual({ x: 370, y: 300, width: 30, height: 50 });
  });
});

describe('useSceneSelectTool — a container and its child on different planes', () => {
  // Camera at 2x over a plane that does not zoom: plane = 2 * camera.
  const ZOOMED: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };

  it('clips a plane child by its camera-layer parent where the parent is drawn', () => {
    const { result } = renderHook(() => {
      const scene = useScene<unknown, 'sky' | 'main', Pose>({
        systemLayers: [{ id: 'main' }, { id: 'sky', parallax: { pan: 1, zoom: 0 } }],
        initial: [
          { id: asNodeId('box'), kind: 'group', layer: 'main', pose: { x: 0, y: 0, width: 50, height: 50 }, clipFromPose: (p: Pose) => ({ kind: 'rect' as const, x: p.x, y: p.y, width: p.width, height: p.height }), data: {} },
          { id: asNodeId('kid'), kind: 'mark', layer: 'sky', parent: asNodeId('box'), pose: { x: 0, y: 0, width: 200, height: 200 }, data: {} },
        ],
      });
      const adapter = useSceneAdapter(scene);
      return useSceneSelectTool({ scene, adapter, getView: () => ZOOMED, geometry: { pickTolerancePx: 0 } });
    });
    // The kid paints over camera 0..100, the box's clip over 0..50.
    expect(result.current.pickEvery({ x: 40, y: 40 })).toEqual(['box', 'kid']);
    expect(result.current.pickEvery({ x: 70, y: 70 })).toEqual([]);
  });
});

describe('useSceneSelectTool — boxing a pose on a plane', () => {
  it('boxes a pose the node is not yet at where the plane would draw it', () => {
    const r = harness();
    // An in-flight pose 100 right of the stored one, carried the plane's 300.
    expect(r.current.boundsOfPose('hill', { x: 100, y: 0, width: 50, height: 50 }))
      .toEqual({ x: 400, y: 0, width: 50, height: 50 });
  });
});

describe('useSceneSelectTool — a node\'s plane', () => {
  it('names the plane a node is drawn through under a camera, and none off a plane', () => {
    const r = harness();
    // pan 0.25 under a camera at x=400: the plane sits 300 left of it.
    expect(r.current.planeOfNode('hill')).toEqual({ scale: { x: 1, y: 1 }, offset: { x: -300, y: 0 } });
    expect(r.current.planeOfNode('crate')).toBeNull();
    expect(r.current.planeOfNode('hill', { x: 0, y: 0, scale: { x: 1, y: 1 } }))
      .toEqual({ scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } });
  });
});
