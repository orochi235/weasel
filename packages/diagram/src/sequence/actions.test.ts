import { createScene, type ActionDeps, type InvocationCtx, type OngoingHandle, type RectPose, type Vec2 } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { withDiagramRegistry } from '../edge';
import { createSequenceDragAction } from './actions';
import { findStep } from './edit';
import { SEQ_FIXTURE as data } from './fixture';
import { SEQUENCE_AFFORDANCE_KIND, placedSequences, type SequenceScratch } from './layer';
import type { SequenceEdit } from './commit';
import { sequenceSpecs } from './specs';
import { sequenceRootOf } from './trait';

const AT = { x: 40, y: 30 };
const KEYS = { alt: false, shift: false, meta: false, ctrl: false };

const sceneOf = () => createScene<unknown, 'main', RectPose>({
  systemLayers: [{ id: 'main' }], initial: sequenceSpecs(data, { id: 'seq', at: AT }) as never, registry: withDiagramRegistry(),
});

type Scene = ReturnType<typeof sceneOf>;

function drag(scene: Scene, press: Vec2, scratch: Omit<SequenceScratch, 'targetId' | 'root'>, commit?: (edit: SequenceEdit) => void) {
  const deps = { scene } as unknown as ActionDeps;
  const ctxAt = (p: Vec2) => ({
    world: p, screen: p, modifiers: KEYS, deps,
    drag: {
      start: press, current: p, delta: { x: p.x - press.x, y: p.y - press.y },
      affordance: { kind: SEQUENCE_AFFORDANCE_KIND, payload: { targetId: 'seq', root: 'seq', ...scratch } },
    },
  }) as unknown as InvocationCtx;
  const invoker = createSequenceDragAction(commit ? { commit } : {}).invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctxAt(press), undefined) as OngoingHandle;
  const to = (p: Vec2, reason: 'commit' | 'cancel' = 'commit') => {
    handle.onMove!(ctxAt(p));
    handle.onEnd!(ctxAt(p), reason);
  };
  return { handle, ctxAt, to };
}

const geometry = (scene: Scene) => placedSequences(scene as never)[0]!.geometry;
const dataOf = (scene: Scene) => sequenceRootOf(scene.get('seq' as never)!)!.sequence;

describe('createSequenceDragAction', () => {
  it('drags a message into a fragment section as one undo entry, previewing it along the way', () => {
    const scene = sceneOf();
    const g = geometry(scene);
    const m5 = g.messages.find((m) => m.id === 'm5')!;
    const slot = g.slots.find((s) => s.place.parent?.fragment === 'f1' && s.place.parent.section === 1 && s.place.index === 1)!;
    const press = { x: AT.x + (m5.x1 + m5.x2) / 2, y: AT.y + m5.y };
    const { handle, ctxAt, to } = drag(scene, press, { part: 'step', id: 'm5' });
    handle.onMove!(ctxAt({ x: press.x, y: AT.y + slot.y }));
    expect([...handle.previewIds!()!]).toContain('seq/msg:m5');
    expect((handle.previewPose!('seq/msg:m5') as RectPose).y).toBeLessThan((scene.get('seq/msg:m5' as never)!.pose as RectPose).y);
    const before = scene.historyIndex();
    to({ x: press.x, y: AT.y + slot.y });
    const frag = findStep(dataOf(scene).steps, 'f1');
    expect(frag?.kind === 'fragment' && frag.sections[1]!.steps.map((s) => ('id' in s ? s.id : s.kind))).toEqual(['m3', 'm5']);
    expect(scene.historyIndex()).toBe(before + 1);
    scene.undo();
    expect(dataOf(scene)).toEqual(data);
  });

  it('drags a head past its neighbor to reorder participants', () => {
    const scene = sceneOf();
    const g = geometry(scene);
    const head = g.heads.find((h) => h.id === 'a')!;
    const press = { x: AT.x + head.box.x + head.box.width / 2, y: AT.y + head.box.y + 5 };
    drag(scene, press, { part: 'head', id: 'a' }).to({ x: AT.x + g.columns[1]!.x + 10, y: press.y });
    expect(dataOf(scene).participants.map((p) => p.id)).toEqual(['b', 'a', 'c']);
  });

  it('drags a message end onto another lifeline', () => {
    const scene = sceneOf();
    const g = geometry(scene);
    const m2 = g.messages.find((m) => m.id === 'm2')!;
    drag(scene, { x: AT.x + m2.x2, y: AT.y + m2.y }, { part: 'end', id: 'm2', end: 'to' }).to({ x: AT.x + g.columns[2]!.x - 4, y: AT.y + m2.y });
    const m = findStep(dataOf(scene).steps, 'm2');
    expect(m?.kind === 'message' && m.to).toBe('c');
  });

  it('commits nothing for a still press or a cancel, and hands a host commit the edit instead of writing it', () => {
    const scene = sceneOf();
    const edits: SequenceEdit[] = [];
    const g = geometry(scene);
    const head = g.heads.find((h) => h.id === 'c')!;
    const press = { x: AT.x + head.box.x + 4, y: AT.y + head.box.y + 4 };
    const still = drag(scene, press, { part: 'head', id: 'c' }, (e) => edits.push(e));
    still.handle.onEnd!(still.ctxAt(press), 'commit');
    drag(scene, press, { part: 'head', id: 'c' }, (e) => edits.push(e)).to({ x: AT.x, y: press.y }, 'cancel');
    expect(edits).toHaveLength(0);
    drag(scene, press, { part: 'head', id: 'c' }, (e) => edits.push(e)).to({ x: AT.x, y: press.y });
    expect(edits.map((e) => [e.id, e.label, e.data.participants[0]!.id])).toEqual([['seq', 'Move participant', 'c']]);
    expect(dataOf(scene)).toBe(data);
  });
});
