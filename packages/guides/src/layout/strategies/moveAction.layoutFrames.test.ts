import { describe, it, expect } from 'vitest';
import {
  moveAction,
  type InvocationCtx,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';
import {
  ABSOLUTE,
  type P,
  makeScene,
  makeCtx,
} from './testing/moveLayoutStubs';

describe('moveAction layout reflow', () => {
  it('writes the dropped child pose LOCAL to the destination container', () => {
    // D at world {200,0}; the snapped cell is D's cell 0 at world {200,0}.
    // Because the scene stores local poses, the committed pose must be {0,0}
    // (local to D), which composes back to the world cell. Pre-commit-migration
    // the transform writes the world pose {200,0} → wrong.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 50, y: 0, width: 50, height: 100 },
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
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 });
  });

  it('lands a drop into a NESTED destination at the correct world position', () => {
    // Outer O at world {100,0} (no layout). Destination D nested under O at
    // LOCAL {50,0} → world {150,0}, holding d1 in cell 1 (local {50,0}). Source C at world
    // {0,0} holds a (local {0,0}). Dragging a into D's cell 0 (world {150,0})
    // must reparent a → D and write a's pose LOCAL to D ({0,0}), guarding the
    // rebase direction (D's world origin ≠ its local pose).
    const scene = makeScene(
      {
        O: { x: 100, y: 0, width: 200, height: 100 },
        D: { x: 50, y: 0, width: 100, height: 100 },
        d1: { x: 50, y: 0, width: 50, height: 100 },
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      { O: null, D: 'O', d1: 'D', C: null, a: 'C' },
      { O: ['D'], D: ['d1'], C: ['a'] },
      ['O', 'C'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid }; // O has no layout
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center {25,50}; delta {150,0} → world center {175,50}, inside D's
    // cell 0 (world {150,0,50,100}).
    const drag = { start: { x: 25, y: 50 }, current: { x: 175, y: 50 }, delta: { x: 150, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 }); // local to D; world = {150,0}
  });

  it('ABSOLUTE model: commits the WORLD cell origin, not rebased to local', () => {
    // Absolute-pose scene (mirrors the kit's base scene + layoutDemo): every
    // node stores WORLD coords; containers are grouping-only with no transform.
    // Source container C at world {40,40} holds child `a` stored at WORLD
    // {40,40}; destination D at world {200,0} holds d1 at WORLD {250,0}.
    // Dragging a into D's cell 0 (world {200,0}) must commit a's pose AS the
    // world cell origin {200,0} — NOT rebased to local {0,0} under D — because
    // the scene composes nothing.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 40, y: 40, width: 50, height: 100 },
        b: { x: 90, y: 40, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 250, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
      ABSOLUTE,
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center {40+25, 40+50} = {65,90}; delta {160,-40} → world center
    // {225,50}, inside D's cell 0 (world {200,0,50,100}).
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    // WORLD cell origin — identity composition leaves the world pose untouched.
    expect(drop!.args?.to).toMatchObject({ x: 200, y: 0 });
  });
});
