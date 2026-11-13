import { createScene, type ActionDeps, type InvocationCtx, type OngoingHandle, type RectPose, type Vec2 } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { createAddMarkAction, createAddNoteAction, createAddParticipantAction } from './authorActions';
import { createDrawMessageAction, createDrawNoteAction, createWrapFragmentAction } from './authorDrags';
import { findStep } from './edit';
import { pagedScene } from '../offPage/pagedFixture';
import { SEQ_FIXTURE as data } from './fixture';
import { placedSequences } from './layer';
import { createSequenceDeleteAction, selectSequencePartAction } from './select';
import { sequenceSpecs } from './specs';
import { sequenceRootOf } from './trait';
import type { Action } from '@weasel-js/core';

const AT = { x: 40, y: 30 };
const KEYS = { alt: false, shift: false, meta: false, ctrl: false };

const sceneOf = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], initial: sequenceSpecs(data, { id: 'seq', at: AT }) as never, registry: withDiagramRegistry(),
});
type Scene = ReturnType<typeof sceneOf>;

const geometry = (scene: Scene) => placedSequences(scene as never)[0]!.geometry;
const dataOf = (scene: Scene, id = 'seq') => sequenceRootOf(scene.get(id as never)!)!.sequence;
const col = (scene: Scene, id: string) => AT.x + geometry(scene).columns.find((c) => c.id === id)!.x;

function run(action: Action, deps: Record<string, unknown>, params: Record<string, unknown>) {
  const invoker = action.invoker!;
  if (invoker.timing !== 'immediate') throw new Error('expected an immediate invoker');
  return invoker.run(deps as ActionDeps, params);
}

function drag(action: Action, scene: Scene, press: Vec2, to: Vec2, params: Record<string, unknown> = {}) {
  const deps = { scene } as unknown as ActionDeps;
  const ctxAt = (p: Vec2) => ({ world: p, screen: p, modifiers: KEYS, deps, drag: { start: press, current: p, delta: { x: 0, y: 0 } } }) as unknown as InvocationCtx;
  const invoker = action.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctxAt(press), { params: () => params }) as OngoingHandle;
  handle.onMove?.(ctxAt(to));
  const overlay = handle.overlay?.();
  handle.onEnd?.(ctxAt(to), 'commit');
  return { handle, overlay };
}

describe('the Participant action', () => {
  it('adds a lifeline where the click falls, as one undo entry', () => {
    const scene = sceneOf();
    const before = scene.historyIndex();
    run(createAddParticipantAction(), { scene }, { world: { x: col(scene, 'a') - 30, y: AT.y + 60 }, kind: 'actor' });
    expect(dataOf(scene).participants.map((p) => p.id)).toEqual(['A1', 'a', 'b', 'c']);
    expect(scene.historyIndex()).toBe(before + 1);
    scene.undo();
    expect(dataOf(scene)).toEqual(data);
  });

  it('starts a sequence on empty canvas with its lifeline at the click', () => {
    const scene = sceneOf();
    run(createAddParticipantAction(), { scene }, { world: { x: 2000, y: 500 } });
    const roots = placedSequences(scene as never);
    expect(roots).toHaveLength(2);
    const fresh = roots.find((r) => r.id !== 'seq')!;
    expect(dataOf(scene, fresh.id)).toEqual({ participants: [{ id: 'P1', label: 'Participant 1' }], steps: [] });
    expect(fresh.origin.x + fresh.geometry.columns[0]!.x).toBeCloseTo(2000, 0);
    scene.undo();
    expect(placedSequences(scene as never)).toHaveLength(1);
  });

  it('starts a sequence in a paged scene on the page under the click, where the click put it', () => {
    const scene = pagedScene([]);
    run(createAddParticipantAction(), { scene }, { world: { x: 300, y: 20 } });
    const root = scene.renderOrderNodes().find((n) => sequenceRootOf(n) !== null)!;
    expect(root.parent).toBe('p2');
    const fresh = placedSequences(scene as never)[0]!;
    expect(fresh.origin.x + fresh.geometry.columns[0]!.x).toBeCloseTo(300, 0);
  });

  it('passes a click off every sequence when a host commit has no start', () => {
    const scene = sceneOf();
    expect(run(createAddParticipantAction({ commit: () => {} }), { scene }, { world: { x: 2000, y: 500 } })).toBe('pass');
  });
});

describe('the Message and Note actions', () => {
  it('draws a self-message when released on its own lifeline, previewing its loop', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    const { overlay } = drag(createDrawMessageAction(), scene, { x: col(scene, 'c'), y }, { x: col(scene, 'c') + 5, y: y + 10 }, { arrow: 'reply' });
    expect(overlay).toMatchObject([{ kind: 'polyline', role: 'connector' }]);
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'message', from: 'c', to: 'c', line: 'dashed' });
  });

  it('reads its arrow from the tool options a drag carries, and replays with another as one undo entry', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    const before = scene.historyIndex();
    const { handle } = drag(createDrawMessageAction(), scene, { x: col(scene, 'a'), y }, { x: col(scene, 'b'), y });
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'message', from: 'a', to: 'b', line: 'solid', head: 'arrow' });
    scene.undo();
    handle.replay?.({ arrow: 'async' });
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'message', from: 'a', to: 'b', head: 'open', async: true });
    expect(scene.historyIndex()).toBe(before + 1);
  });

  it('replays a fragment drag with another type', () => {
    const scene = sceneOf();
    const slots = geometry(scene).slots;
    const { handle } = drag(createWrapFragmentAction(), scene, { x: col(scene, 'a'), y: AT.y + slots[0]!.y }, { x: col(scene, 'a'), y: AT.y + slots[1]!.y });
    const id = dataOf(scene).steps.find((s) => s.kind === 'fragment')!.id;
    expect(findStep(dataOf(scene).steps, id)).toMatchObject({ type: 'loop' });
    scene.undo();
    handle.replay?.({ type: 'par' });
    expect(findStep(dataOf(scene).steps, id)).toMatchObject({ type: 'par' });
  });

  it('hands a host commit the deps the drag started with, when its end carries none', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    const press = { x: col(scene, 'a'), y };
    const to = { x: col(scene, 'b'), y };
    const applyOps = () => {};
    const seen: unknown[] = [];
    const invoker = createDrawMessageAction({ commit: (_edit, ctx) => seen.push(ctx.deps.applyOps) }).invoker!;
    if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const ctxAt = (p: Vec2, deps: unknown) => ({ world: p, screen: p, modifiers: KEYS, deps, drag: { start: press, current: p, delta: { x: 0, y: 0 } } }) as unknown as InvocationCtx;
    const handle = invoker.start(ctxAt(press, { scene, applyOps }), { params: () => ({}) }) as OngoingHandle;
    handle.onMove?.(ctxAt(to, {}));
    handle.onEnd?.(ctxAt(to, {}), 'commit');
    expect(seen).toEqual([applyOps]);
  });

  it('starts nothing off every sequence, so the press falls through', () => {
    const scene = sceneOf();
    const invoker = createDrawMessageAction().invoker as { start: (ctx: unknown) => OngoingHandle };
    const p = { x: 3000, y: 3000 };
    expect(invoker.start({ world: p, screen: p, modifiers: KEYS, deps: { scene } })).toEqual({});
  });

  it('drops a note over a lifeline, or beside it on the side clicked', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    run(createAddNoteAction(), { scene }, { world: { x: col(scene, 'b') + 2, y } });
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'note', over: ['b'] });
    expect('side' in dataOf(scene).steps[0]!).toBe(false);
    run(createAddNoteAction(), { scene }, { world: { x: col(scene, 'b') + 40, y } });
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'note', over: ['b'], side: 'right' });
  });

  it('spans a dragged note over the lifelines it crosses', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    drag(createDrawNoteAction(), scene, { x: col(scene, 'c'), y }, { x: col(scene, 'a'), y });
    expect(dataOf(scene).steps[0]).toMatchObject({ kind: 'note', over: ['a', 'c'] });
  });
});

describe('the Mark action', () => {
  it('puts the chosen mark on the nearest lifeline at the nearest row, a creation once', () => {
    const scene = sceneOf();
    const y = AT.y + geometry(scene).slots[0]!.y;
    run(createAddMarkAction(), { scene }, { world: { x: col(scene, 'c') + 3, y }, mark: 'destroy' });
    expect(dataOf(scene).steps[0]).toEqual({ kind: 'destroy', participant: 'c' });
    run(createAddMarkAction(), { scene }, { world: { x: col(scene, 'b'), y } });
    expect(dataOf(scene).steps[0]).toEqual({ kind: 'activate', participant: 'b' });
    const before = scene.historyIndex();
    run(createAddMarkAction(), { scene }, { world: { x: col(scene, 'a'), y }, mark: 'create' });
    run(createAddMarkAction(), { scene }, { world: { x: col(scene, 'a'), y }, mark: 'create' });
    expect(scene.historyIndex()).toBe(before + 1);
  });
});

describe('picking and deleting parts', () => {
  const selectionOf = (held: string[]) => ({ get: () => held, set: (next: string[]) => { held.splice(0, held.length, ...next); } });

  it('picks the node drawing a part, Shift adding to the pick', () => {
    const scene = sceneOf();
    const held: string[] = [];
    const selection = selectionOf(held);
    const hit = (part: string, id: string) => ({ payload: { targetId: 'seq', root: 'seq', part, id } });
    run(selectSequencePartAction, { scene, selection }, { affordance: hit('head', 'a') });
    run(selectSequencePartAction, { scene, selection }, { affordance: hit('step', 'f1'), mods: { shift: true } });
    expect(held).toEqual(['seq/head:a', 'seq/frag:f1']);
  });

  it('deletes a head\'s participant and a fragment as one edit, and the rest as core does', () => {
    const scene = sceneOf();
    scene.add({ id: 'loose', kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 }, data: {} } as never);
    const held = ['seq/head:c', 'seq/frag:f1', 'loose'];
    run(createSequenceDeleteAction(), { scene, selection: { ...selectionOf(held), adapterMethods: {} } }, {});
    const next = dataOf(scene);
    expect(next.participants.map((p) => p.id)).toEqual(['a', 'b']);
    expect(findStep(next.steps, 'f1')).toBeNull();
    expect(findStep(next.steps, 'm5')).toBeNull();
    expect(scene.get('loose' as never)).toBeUndefined();
    expect(held).toEqual([]);
  });
});
