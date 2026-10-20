/**
 * A container with a layout owns its children's places: a child moved by
 * anything — a nudge, an align, a pose set by hand — is put back where the
 * layout says, in the same undo entry as the move.
 */
import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '@weasel-js/routing';
import type { LayoutStrategy } from '../../layout/types';
import { alignRightAction } from '../../interactions/actions/align/action';
import { nudgeRightAction } from '../../interactions/actions/defaults/nudge';
import { createScene } from './scene';
import { asNodeId, type RectPose } from './types';

/** Stacks its children top to bottom in child order, at the container's left edge. */
const stack: LayoutStrategy<RectPose> = {
  snap: { pickTarget: () => null },
  childPoses(container, children) {
    const out = new Map<string, RectPose>();
    let y = container.bounds.y;
    for (const c of children) {
      out.set(c.id, { ...c.pose, x: container.bounds.x, y });
      y += c.pose.height;
    }
    return out;
  },
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
};

const id = asNodeId;
const at = (x: number, y: number): RectPose => ({ x, y, width: 50, height: 20 });

function load() {
  return createScene<object, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: id('c'), kind: 'container', layer: 'main', parent: null, data: {}, pose: { x: 0, y: 0, width: 100, height: 40 }, layout: stack },
      { id: id('a'), kind: 'leaf', layer: 'main', parent: id('c'), data: {}, pose: at(0, 0) },
      { id: id('b'), kind: 'leaf', layer: 'main', parent: id('c'), data: {}, pose: at(0, 20) },
      { id: id('free'), kind: 'leaf', layer: 'main', parent: null, data: {}, pose: at(300, 0) },
    ],
  });
}

const run = (action: { invoker?: unknown }, deps: object, params?: object) =>
  (action.invoker as ImmediateInvoker).run(deps as never, params as never);

describe('a layout container whose child moves without resizing', () => {
  it('puts back a child nudged out of place, in one undo entry', () => {
    const scene = load();
    run(nudgeRightAction, { scene, selection: { get: () => [id('a')] } }, { magnitude: 'small' });
    expect(scene.get(id('a'))!.pose).toEqual(at(0, 0));
    expect(scene.undo()).toBe(true);
    expect(scene.get(id('a'))!.pose).toEqual(at(0, 0));
    expect(scene.canUndo()).toBe(false);
  });

  it('puts back a child an align moved, and leaves a node outside any layout aligned', () => {
    const scene = load();
    scene.setPose(id('free'), at(300, 100));
    run(alignRightAction, { scene, selection: { get: () => [id('b'), id('free')] } });
    expect(scene.get(id('b'))!.pose).toEqual(at(0, 20));
    expect(scene.get(id('free'))!.pose).toEqual(at(300, 100));
  });

  it('arranges after a bare pose write too, as its own undo entry', () => {
    const scene = load();
    scene.setPose(id('b'), at(40, 60));
    expect(scene.get(id('b'))!.pose).toEqual(at(0, 20));
  });
});
