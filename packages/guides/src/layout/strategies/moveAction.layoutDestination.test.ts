import { describe, it, expect } from 'vitest';
import {
  moveAction,
  type InvocationCtx,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';
import {
  squarePolygon,
  ABSOLUTE,
  type P,
  makeScene,
  makeCtx,
  heldPose,
} from './testing/moveLayoutStubs';

describe('moveAction layout reflow', () => {
  it('folds destination reflow into previews when dragging within a tileGrid', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed into the preview channel
    const bPose = heldPose(scene, 'b')!;
    expect(bPose.x).toBe(0); // b swapped to cell 0
  });

  it('skips a container whose acceptsDrop rejects the dragged node', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const seen: string[] = [];
    const picky = {
      ...tileGrid<P>({ cols: 2, rows: 1 }),
      acceptsDrop: (container: { id: string }, dragged: { id: string }) => {
        seen.push(`${container.id}:${dragged.id}`);
        return false;
      },
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, { C: picky }));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }, { C: picky }) as InvocationCtx);

    expect(seen).toEqual(['C:a']);
    // No reflow: only the dragged node is in the preview channel.
    expect([...(handle.previewIds!() as Iterable<string>)]).toEqual(['a']);
  });

  it('finds a container whose pose is non-rect (PolygonPath) via its AABB', () => {
    // Container C carries a PolygonPath pose (no direct x/y/width/height).
    // Absolute-pose model so composeWorldPose leaves the
    // non-rect pose intact. The layout hit-test must derive C's AABB from the
    // pose descriptor; casting the polygon to `{x,y,width,height}` yields NaN
    // and the container is never found — no reflow fires.
    const scene = makeScene(
      {
        C: squarePolygon(0, 0, 100, 100) as unknown as P,
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
      ABSOLUTE,
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed → container WAS found
    const bPose = heldPose(scene, 'b')!;
    expect(bPose.x).toBe(0); // b swapped to cell 0
  });

  it('finds the destination when the source container is not at world origin', () => {
    // Source C at world {40,40} holds child a (LOCAL {0,0}); destination D at
    // world {200,0} holds d1 (LOCAL {0,0}). Pre-migration draggedCenter is
    // computed in C-local space, so it never lands inside D's world bounds —
    // the drag falls through to a translate-only commit (no reparent op,
    // appliedBatches stays empty).
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center starts at {40+25, 40+50} = {65,90}. delta {160,-40} puts
    // the world center at {225,50}, inside D's first cell.
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
  });
});
