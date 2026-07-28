/**
 * Coverage for `useSelectTool`'s clip-aware default `pickEvery`.
 *
 * The default `pickEvery` walks the scene hierarchy and excludes nodes whose
 * world position does not fall within an ancestor container's clip. These
 * tests press at a world point through `select.pick` — the action the tool's
 * `pointerDown` binding routes to — and assert what ends up selected:
 *
 * 1. A leaf outside an ancestor's clip is not selectable.
 * 2. A leaf inside an ancestor's clip is selectable.
 * 3. A container is selectable when the press is inside its clip.
 * 4. A container is NOT selectable when the press is outside its clip.
 * 5. A plain scene with no clips is unaffected (regression guard).
 *
 * These used to drive a real `<Canvas>` pointer sequence, which meant working
 * around jsdom: the canvas has no layout, so `clientToWorld` never ran and
 * every press landed at world (0,0) — all the geometry below had to be
 * arranged around that origin. Pressing the action directly lets each case
 * name its own world point.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import type { UseSceneOptions } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool } from './useSelectTool';
import { rectPath } from 'features/paths/builder';
import { asNodeId } from 'core/scene/types';
import type { Action } from '../../../interactions/actions/registry';
import type { ActionDeps } from '../../../interactions/actions/invoker';

interface Item { label: string }
type Pose = { x: number; y: number; width: number; height: number };

/** Mounts the select tool over a scene and returns a `press(x, y)` that fires
 *  `select.pick` the way the dispatcher's eager pointerdown does. No
 *  `pickEvery` override — the default clip-aware walk is what's under test. */
function harness(initial: UseSceneOptions<Item, 'default', Pose>['initial']) {
  const { result } = renderHook(() => {
    const scene = useScene<Item, 'default', Pose>({
      systemLayers: [{ id: 'default' }],
      initial,
    });
    const sel = useSelection({ mode: 'single' });
    const adapter = sceneToAdapter(scene, { selection: sel });
    return { tool: useSelectTool(adapter as never, {}), sel };
  });

  return {
    press(x: number, y: number) {
      const tool = result.current.tool as { actions?: readonly Action[] };
      const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
      if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
      act(() => {
        invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
          worldX: x,
          worldY: y,
          mods: { alt: false, ctrl: false, meta: false, shift: false },
        });
      });
    },
    selection: () => result.current.sel.current,
  };
}

describe('useSelectTool default pickEvery — clip-aware', () => {
  it('does not pick a leaf whose AABB is outside an ancestor container clip', () => {
    // The press point is inside the leaf's AABB but outside the container's
    // clip. A flat AABB scan would select the leaf; the clip-aware walk
    // rejects it.
    const h = harness([
      {
        id: asNodeId('bed'),
        kind: 'container',
        layer: 'default',
        pose: { x: -10, y: -10, width: 100, height: 100 },
        data: { label: 'bed' },
        clipFromPose: () => rectPath(50, 50, 50, 50),
      },
      {
        id: asNodeId('corner'),
        parent: asNodeId('bed'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: -5, y: -5, width: 20, height: 20 },
        data: { label: 'corner' },
      },
    ]);
    h.press(0, 0);
    expect(h.selection()).toEqual([]);
  });

  it('picks a leaf whose AABB is inside an ancestor container clip', () => {
    // Paired with the case above. The clip is deliberately smaller than the
    // container's AABB, so passing documents clip-pass rather than
    // pure-AABB-pass. `pickTopMostHit` drops the ancestor, leaving the leaf.
    const h = harness([
      {
        id: asNodeId('bed'),
        kind: 'container',
        layer: 'default',
        pose: { x: -50, y: -50, width: 100, height: 100 },
        data: { label: 'bed' },
        clipFromPose: () => rectPath(-20, -20, 40, 40),
      },
      {
        id: asNodeId('inner'),
        parent: asNodeId('bed'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: -5, y: -5, width: 10, height: 10 },
        data: { label: 'inner' },
      },
    ]);
    h.press(0, 0);
    expect(h.selection()).toContain(asNodeId('inner'));
  });

  it('container with a clip is selectable when the press is inside the clip', () => {
    const h = harness([
      {
        id: asNodeId('bed'),
        kind: 'container',
        layer: 'default',
        pose: { x: 0, y: 0, width: 100, height: 100 },
        data: { label: 'bed' },
        clipFromPose: (pose: Pose) => rectPath(pose.x, pose.y, pose.width, pose.height),
      },
    ]);
    h.press(50, 50);
    expect(h.selection()).toContain(asNodeId('bed'));
  });

  it('container with a clip is NOT selectable when the press is outside its clip', () => {
    // Inside the AABB, outside the clip.
    const h = harness([
      {
        id: asNodeId('bed'),
        kind: 'container',
        layer: 'default',
        pose: { x: 0, y: 0, width: 100, height: 100 },
        data: { label: 'bed' },
        clipFromPose: () => rectPath(25, 25, 50, 50),
      },
    ]);
    h.press(5, 5);
    expect(h.selection()).toEqual([]);
  });

  it('plain scene without clips is unaffected (regression guard)', () => {
    const h = harness([
      {
        id: asNodeId('A'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 0, y: 0, width: 50, height: 50 },
        data: { label: 'A' },
      },
      {
        id: asNodeId('B'),
        kind: 'leaf',
        layer: 'default',
        pose: { x: 60, y: 60, width: 50, height: 50 },
        data: { label: 'B' },
      },
    ]);
    h.press(25, 25);
    expect(h.selection()).toContain(asNodeId('A'));
    expect(h.selection()).not.toContain(asNodeId('B'));
  });
});
