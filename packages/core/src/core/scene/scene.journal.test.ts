import { describe, it, expect } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import { createTransformOp } from 'core/ops/transform';

const POSE = { x: 0, y: 0, width: 10, height: 10 };
const A = asNodeId('a');

function makeScene() {
  const scene = createScene<{ label: string }, 'default'>({ systemLayers: [{ id: 'default' }] });
  scene.add({ id: A, kind: 'mark', layer: 'default', pose: { ...POSE }, data: { label: 'a' } });
  scene.history.clear();
  const adapter = { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } };
  const move = (from: number, to: number) =>
    scene.applyBatch([createTransformOp({ id: A, from: { ...POSE, x: from }, to: { ...POSE, x: to } })], 'move', adapter);
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
