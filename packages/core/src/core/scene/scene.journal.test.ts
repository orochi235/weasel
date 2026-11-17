import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { createSetPoseOp } from 'core/ops/setPose';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const A = asNodeId('a');

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: A, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'a' } });
  scene.history.clear();
  const adapter = { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } };
  const move = (from: number, to: number) =>
    scene.applyBatch([createSetPoseOp({ id: A, from: { ...POSE, x: from }, to: { ...POSE, x: to } })], 'move', adapter);
  const x = () => scene.get(A)!.pose.x;
  return { scene, move, x };
}

describe('Scene — applyBatch under a journal opened on scene.history', () => {
  it('applies adapter-driven ops against the call-site adapter', () => {
    const { scene, move, x } = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    move(0, 5);
    expect(x()).toBe(5);
    expect(scene.history.undoDepth()).toBe(0);
    expect(journal.entries().undo).toHaveLength(1);
  });

  it('undoes and redoes inside the session, then as one step once committed', () => {
    const { scene, move, x } = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    move(0, 5);
    move(5, 9);
    journal.undo();
    expect(x()).toBe(5);
    journal.redo();
    expect(x()).toBe(9);

    journal.commit('Move');
    expect(scene.history.undoDepth()).toBe(1);
    scene.undo();
    expect(x()).toBe(0);
    scene.redo();
    expect(x()).toBe(9);
  });

  it('cancel rewinds the session', () => {
    const { scene, move, x } = makeScene();
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    move(0, 5);
    move(5, 9);
    journal.cancel();
    expect(x()).toBe(0);
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('undo and redo step the open journal, and the scene history once it closes', () => {
    const { scene, move, x } = makeScene();
    move(0, 2);
    const journal = scene.history.beginJournal({ label: 'session' });
    scene.setActiveJournalAccessor(() => (journal.isActive() ? journal : null));

    move(2, 5);
    move(5, 9);
    expect(scene.canUndo()).toBe(true);
    scene.undo();
    expect(x()).toBe(5);
    scene.history.undo();
    expect(x()).toBe(2);
    // The session is empty; the move before it is not the session's to take back.
    expect(scene.canUndo()).toBe(false);
    expect(scene.undo()).toBe(false);
    expect(x()).toBe(2);
    scene.redo();
    expect(x()).toBe(5);
    expect(scene.history.undoDepth()).toBe(1);

    journal.suspend();
    expect(scene.canUndo()).toBe(true);
    scene.undo();
    expect(x()).toBe(0);
  });
});

describe('Scene — a journal opened on scene.history with no accessor', () => {
  it('takes the edits made while it is open', () => {
    const { scene, move, x } = makeScene();
    const journal = scene.history.beginJournal({ label: 'stroke' });
    move(0, 5);
    expect(scene.history.undoDepth()).toBe(0);
    journal.commit('Stroke');
    expect(scene.history.undoDepth()).toBe(1);
    scene.undo();
    expect(x()).toBe(0);
  });

  it('opens inside the one already open, landing there as one entry', () => {
    const { scene, move, x } = makeScene();
    const mode = scene.history.beginJournal({ label: 'mode' });
    scene.setActiveJournalAccessor(() => (mode.isActive() ? mode : null));
    move(0, 2);
    const stroke = scene.history.beginJournal({ label: 'stroke' });
    move(2, 5);
    move(5, 9);
    stroke.commit('Stroke');
    expect(mode.entries().undo.map((e) => e.label)).toEqual(['move', 'Stroke']);
    scene.undo();
    expect(x()).toBe(2);
    mode.commit('Mode');
    expect(scene.history.undoDepth()).toBe(1);
  });

  it('canceled inside another, leaves the outer one as it was', () => {
    const { scene, move, x } = makeScene();
    const mode = scene.history.beginJournal({ label: 'mode' });
    move(0, 2);
    const stroke = scene.history.beginJournal({ label: 'stroke' });
    move(2, 7);
    stroke.cancel();
    expect(x()).toBe(2);
    move(2, 3);
    expect(mode.entries().undo).toHaveLength(2);
  });
});

describe('Scene — journal state its subscribers hear', () => {
  it('notifies when opening, suspending or resuming a journal changes what canUndo answers', () => {
    const { scene, move } = makeScene();
    move(0, 5);
    let heard = 0;
    scene.subscribe(() => { heard++; });
    const seen: boolean[] = [];
    const note = (fn: () => void) => { const before = heard; fn(); expect(heard).toBeGreaterThan(before); seen.push(scene.canUndo()); };
    let journal!: ReturnType<typeof scene.history.beginJournal>;
    note(() => { journal = scene.history.beginJournal({ label: 'session' }); });
    note(() => journal.suspend());
    note(() => scene.history.resumeJournal(journal));
    expect(seen).toEqual([false, true, false]);
  });
});

describe('Scene — history.goto holds to the History contract', () => {
  it('throws a RangeError for a depth outside the entries or not whole, and while a journal is open', () => {
    const { scene, move, x } = makeScene();
    move(0, 5);
    move(5, 9);
    for (const n of [-1, 3, 1.5, NaN, Infinity]) expect(() => scene.history.goto(n), String(n)).toThrow(RangeError);
    expect(x()).toBe(9);
    scene.history.goto(1);
    expect(x()).toBe(5);
    const journal = scene.history.beginJournal({ label: 'session' });
    expect(() => scene.history.goto(0)).toThrow(/journal/);
    journal.cancel();
    expect(x()).toBe(5);
  });
});
