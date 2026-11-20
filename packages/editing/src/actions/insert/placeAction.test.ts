import { describe, it, expect } from 'vitest';
import type { ActionDeps } from '@weasel-js/routing';
import type { NodeId } from '@weasel-js/core';
import { IDENTITY_POSE_COMPOSITION, createScene } from '@weasel-js/core/engine';
import { gridSourceForTests as gridSource, sessionDepForTests as sessionDep } from '@weasel-js/core/test-seams';
import type { InsertDep, SnapDep } from '@weasel-js/core/engine';
import { placeAction } from './placeAction';

function makeInsertDep(): InsertDep & { calls: Array<{ bounds: unknown; extras: Record<string, unknown> }> } {
  const calls: Array<{ bounds: unknown; extras: Record<string, unknown> }> = [];
  return {
    calls,
    commit(bounds, extras) {
      calls.push({ bounds: { ...bounds }, extras: extras as Record<string, unknown> });
      return 'new' as NodeId;
    },
  };
}

function makeSelection(ids: string[]) {
  let sel = [...ids];
  return { get: () => sel, clear: () => { sel = []; }, set: (next: string[]) => { sel = [...next]; } };
}

/** A click as the dispatcher hands one to an immediate action: the binding's
 *  params with the click's world and press points laid under them. */
function click(params: Record<string, unknown>, deps: Partial<ActionDeps>, at = { x: 100, y: 50 }) {
  if (placeAction.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  placeAction.invoker.run(deps as ActionDeps, { world: { x: at.x, y: at.y }, press: { x: at.x, y: at.y }, ...params });
}

describe('placeAction — a minimum size', () => {
  it('places a node no smaller than the binding\'s minSize, centered on the click', () => {
    const insert = makeInsertDep();
    const minSize = { width: 48, height: 30 };
    click({ kind: 'sticky', size: { width: 40, height: 40 }, minSize }, { insert });
    expect(insert.calls[0].bounds).toEqual({ x: 76, y: 30, width: 48, height: 40 });
    expect(insert.calls[0].extras.minSize).toEqual(minSize);
  });
});

describe('placeAction', () => {
  it('commits a node of the binding\'s kind and size, centered on the click', () => {
    const insert = makeInsertDep();
    click({ kind: 'sticky', size: { width: 40, height: 20 } }, { insert });
    expect(insert.calls).toHaveLength(1);
    expect(insert.calls[0].bounds).toEqual({ x: 80, y: 40, width: 40, height: 20 });
    expect(insert.calls[0].extras.kind).toBe('sticky');
  });

  it('hands the binding\'s params on as extras, and none of the click\'s', () => {
    const insert = makeInsertDep();
    click({ kind: 'sticky', size: { width: 40, height: 20 }, padding: 4 }, { insert });
    expect(insert.calls[0].extras).toEqual({ kind: 'sticky', originMode: 'center', padding: 4 });
  });

  it('hands the style its params carry on as extras.style, as a drag does', () => {
    const insert = makeInsertDep();
    const fill = { kind: 'solid', color: '#123456' };
    click({ kind: 'rect', size: { width: 40, height: 20 }, fill, strokeWidth: 3 }, { insert });
    expect(insert.calls[0].extras.style).toEqual({ fill, strokeWidth: 3 });
  });

  it('snaps the center through the snap dep', () => {
    const insert = makeInsertDep();
    const snap: SnapDep = sessionDep(createScene({ systemLayers: [{ id: 'main' }] }) as never, [gridSource(25)]);
    click({ kind: 'sticky', size: { width: 40, height: 20 } }, { insert, snap }, { x: 103, y: 48 });
    expect(insert.calls[0].bounds).toEqual({ x: 80, y: 40, width: 40, height: 20 });
  });

  it('tells the snap session the container the node lands in', () => {
    const scene = createScene<object, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } }) as string;
    const told: Array<string | undefined> = [];
    const spy = { id: 'spy', roles: ['pointer'], *collect(q: { parent?: string }) { told.push(q.parent); } };
    const snap: SnapDep = sessionDep(scene as never, [spy as never]);
    click({ kind: 'sticky', size: { width: 40, height: 20 } }, { insert: makeInsertDep(), snap, scene, insertInto: { get: () => g } } as never);
    expect(told).toEqual([g]);
  });

  it('leaves the center on the click while Ctrl suspends snapping, and keeps the click\'s modifiers out of the extras', () => {
    const insert = makeInsertDep();
    const snap: SnapDep = sessionDep(createScene({ systemLayers: [{ id: 'main' }] }) as never, [gridSource(25)]);
    const mods = { alt: false, ctrl: true, meta: false, shift: false };
    click({ kind: 'sticky', size: { width: 40, height: 20 }, mods }, { insert, snap }, { x: 103, y: 48 });
    expect(insert.calls[0].bounds).toEqual({ x: 83, y: 38, width: 40, height: 20 });
    expect(insert.calls[0].extras).toEqual({ kind: 'sticky', originMode: 'center' });
    expect(placeAction.modifierRoles).toHaveProperty(['snap.suspend']);
  });

  it('places nothing with no size, which a click cannot draw', () => {
    const insert = makeInsertDep();
    click({ kind: 'rect' }, { insert });
    expect(insert.calls).toEqual([]);
  });

  it('clears the selection, as starting a drawn insert does', () => {
    const insert = makeInsertDep();
    const selection = makeSelection(['a']);
    click({ kind: 'rect', size: { width: 10, height: 10 } }, { insert, operands: selection } as never);
    expect(selection.get()).toEqual([]);
  });

  it('puts the selection back when the insert dep places nothing', () => {
    const insert: InsertDep = { commit: () => null };
    const selection = makeSelection(['a']);
    click({ kind: 'rect', size: { width: 10, height: 10 } }, { insert, operands: selection } as never);
    expect(selection.get()).toEqual(['a']);
  });

  it('puts the selection back and closes the snap session when the insert dep throws', () => {
    const insert: InsertDep = { commit: () => { throw new Error('factory'); } };
    const selection = makeSelection(['a']);
    let open = 0;
    const snap = { begin: () => { open++; return { at: (p: unknown) => ({ point: p, held: false, marks: [] }), end: () => { open--; } }; } };
    expect(() => click({ kind: 'rect', size: { width: 10, height: 10 } }, { insert, operands: selection, snap } as never)).toThrow('factory');
    expect(selection.get()).toEqual(['a']);
    expect(open).toBe(0);
  });

  it('puts the selection back and closes the snap session when the snap throws', () => {
    const selection = makeSelection(['a']);
    let open = 0;
    const snap = { begin: () => { open++; return { at: () => { throw new Error('snap'); }, end: () => { open--; } }; } };
    expect(() => click({ kind: 'rect', size: { width: 10, height: 10 } }, { insert: makeInsertDep(), operands: selection, snap } as never)).toThrow('snap');
    expect(selection.get()).toEqual(['a']);
    expect(open).toBe(0);
  });

  it('suspends snapping on whatever key the dispatcher resolved snap.suspend to, and keeps the roles out of the extras', () => {
    const insert = makeInsertDep();
    const snap: SnapDep = sessionDep(createScene({ systemLayers: [{ id: 'main' }] }) as never, [gridSource(25)]);
    const mods = { alt: true, ctrl: false, meta: false, shift: false };
    const roles = { 'snap.suspend': true, 'snap.constrain': false };
    click({ kind: 'sticky', size: { width: 40, height: 20 }, mods, roles }, { insert, snap }, { x: 103, y: 48 });
    expect(insert.calls[0].bounds).toEqual({ x: 83, y: 38, width: 40, height: 20 });
    expect(insert.calls[0].extras).toEqual({ kind: 'sticky', originMode: 'center' });
  });
});

describe('placeAction — a built-in kind\'s extras, as a drag out from the click makes them', () => {
  const size = { width: 40, height: 20 };

  it('hands a rect only its kind and style, not its style params at the top level', () => {
    const insert = makeInsertDep();
    const fill = { kind: 'solid', color: '#123456' };
    click({ kind: 'rect', size, fill }, { insert });
    expect(insert.calls[0].extras).toEqual({ kind: 'rect', style: { fill } });
  });

  it('gives a line its two ends', () => {
    const insert = makeInsertDep();
    click({ kind: 'line', size }, { insert });
    expect(insert.calls[0].extras).toEqual({ kind: 'line', a: { x: 80, y: 40 }, b: { x: 120, y: 60 } });
  });

  it('gives a polygon a numeric side count, a center and a rotation', () => {
    const insert = makeInsertDep();
    click({ kind: 'polygon', size, sides: '5' }, { insert });
    expect(insert.calls[0].extras).toMatchObject({ kind: 'polygon', sides: 5, center: { x: 100, y: 50 }, rotation: Math.atan2(10, 20) });
  });
});
