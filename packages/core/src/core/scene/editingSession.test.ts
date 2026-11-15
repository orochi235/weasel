import { describe, it, expect, vi } from 'vitest';
import { createScene } from './scene';
import { createEditingSession, isEditingSession } from './editingSession';
import { documentOf } from './documentOf';
import { effectivePose } from './effectivePose';
import { unionOfChildren } from './kitRegistry';
import type { NodeId, RectPose } from './types';

const box = (x: number, y: number, w = 10, h = 10): RectPose => ({ x, y, width: w, height: h });

function makeScene() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const add = (x = 0) => scene.add({ kind: 'mark', layer: 'main', pose: box(x, 0), data: {} });
  return { scene, add };
}

describe('createEditingSession — what a session owns', () => {
  it('selects apart from the scene and from another session', () => {
    const { scene, add } = makeScene();
    const [a, b, c] = [add(), add(10), add(20)];
    const one = createEditingSession(scene);
    const two = createEditingSession(scene);

    scene.setSelection([a]);
    one.setSelection([b]);
    two.setSelection([c]);

    expect(scene.getSelection()).toEqual([a]);
    expect(one.getSelection()).toEqual([b]);
    expect(two.getSelection()).toEqual([c]);
  });

  it('previews and scrolls apart, over the document they share', () => {
    const { scene, add } = makeScene();
    const a = add();
    const one = createEditingSession(scene);
    const two = createEditingSession(scene);

    one.overrides.set(a, { pose: box(50, 0) });
    one.scroll.set(a, { x: 5, y: 0 });

    expect(effectivePose(one, one.get(a)!)).toEqual(box(50, 0));
    expect(effectivePose(two, two.get(a)!)).toEqual(box(0, 0));
    expect(effectivePose(scene, scene.get(a)!)).toEqual(box(0, 0));
    expect(two.scroll.get(a)).toBeUndefined();
    expect(scene.scroll.get(a)).toBeUndefined();

    two.setPose(a, box(30, 0));
    expect(one.get(a)!.pose).toEqual(box(30, 0));
    expect(scene.get(a)!.pose).toEqual(box(30, 0));
    expect(documentOf(one).overrides.has(a)).toBe(false);
  });

  it('derives a container from the previews of the session reading it', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const g = scene.add({ kind: 'group', layer: 'main', pose: box(0, 0, 0, 0), data: {}, dependsOn: 'children', derivePose: unionOfChildren });
    const m = scene.add({ kind: 'mark', parent: g, layer: 'main', pose: box(0, 0), data: {} });
    const one = createEditingSession(scene);
    const two = createEditingSession(scene);

    one.overrides.set(m, { pose: box(90, 0) });
    expect(effectivePose(one, one.get(g)!)).toEqual(box(90, 0));
    expect(effectivePose(two, two.get(g)!)).toEqual(box(0, 0));
    expect(effectivePose(one, one.get(g)!)).toEqual(box(90, 0));
  });

  it('drops a removed node from every session, and loadState clears every session', () => {
    const { scene, add } = makeScene();
    const [a, b] = [add(), add(10)];
    const one = createEditingSession(scene);
    one.setSelection([a, b]);
    one.overrides.set(b, { pose: box(5, 5) });
    scene.setSelection([a]);

    scene.remove(a);
    expect(one.getSelection()).toEqual([b]);
    expect(scene.getSelection()).toEqual([]);

    one.scroll.set(b, { x: 1, y: 1 });
    scene.loadState(scene.toJSON());
    expect(one.overrides.ids()).toEqual([]);
    expect([...one.scroll.ids()]).toEqual([]);
    expect(one.getSelection()).toEqual([b]);
  });

  it('tells its subscribers of its own selection and of document edits, and the scene of neither selection', () => {
    const { scene, add } = makeScene();
    const a = add();
    const one = createEditingSession(scene);
    const heardOne = vi.fn();
    const heardScene = vi.fn();
    one.subscribe(heardOne);
    scene.subscribe(heardScene);

    const before = one.getVersion();
    one.setSelection([a]);
    expect(heardOne).toHaveBeenCalledTimes(1);
    expect(heardScene).not.toHaveBeenCalled();
    expect(one.getVersion()).toBeGreaterThan(before);
    expect(one.getContentVersion()).toBe(scene.getContentVersion());

    scene.setPose(a, box(1, 0));
    expect(heardOne).toHaveBeenCalledTimes(2);
    expect(heardScene).toHaveBeenCalledTimes(1);
  });

  it('opens over a session’s document, and refuses a document reading', () => {
    const { scene } = makeScene();
    const one = createEditingSession(scene);
    expect(createEditingSession(one).document).toBe(scene);
    expect(isEditingSession(one)).toBe(true);
    expect(isEditingSession(scene)).toBe(false);
    expect(() => createEditingSession(documentOf(scene))).toThrow(/documentOf/);
  });
});

describe('createEditingSession — one history, and whose selection it restores', () => {
  it('records the selection of the session an edit is made through', () => {
    const { scene, add } = makeScene();
    const [a, b] = [add(), add(10)];
    const one = createEditingSession(scene);
    scene.setSelection([a]);
    one.setSelection([b]);

    one.setPose(b, box(40, 0));
    one.setSelection([]);
    expect(scene.canUndo()).toBe(true);

    one.undo();
    expect(one.getSelection()).toEqual([b]);
    expect(scene.getSelection()).toEqual([a]);
    expect(scene.get(b)!.pose).toEqual(box(10, 0));
  });

  it('restores the selection into the session that steps history, whichever made the edit', () => {
    const { scene, add } = makeScene();
    const [a, b] = [add(), add(10)];
    const one = createEditingSession(scene);
    const two = createEditingSession(scene);
    one.setSelection([a]);
    one.setPose(a, box(40, 0));
    two.setSelection([b]);

    two.undo();
    expect(two.getSelection()).toEqual([a]);
    expect(one.getSelection()).toEqual([a]);
    expect(scene.getSelection()).toEqual([]);

    // A redo restores what the last session to undo the entry held when it undid, into the session redoing.
    two.setSelection([]);
    scene.redo();
    expect(scene.getSelection()).toEqual([b]);
    expect(two.getSelection()).toEqual([]);
    expect(scene.get(a)!.pose).toEqual(box(40, 0));
  });

  it('steps through its history dep as itself', () => {
    const { scene, add } = makeScene();
    const a = add();
    const one = createEditingSession(scene);
    one.setSelection([a]);
    one.setPose(a, box(40, 0));
    one.setSelection([]);

    one.history.undo();
    expect(one.getSelection()).toEqual([a]);
    expect(scene.getSelection()).toEqual([]);
  });

  it('puts back the acting session’s selection when a batch is refused', () => {
    const { scene, add } = makeScene();
    const a = add();
    const one = createEditingSession(scene);
    one.setSelection([a]);
    expect(() => one.batch('fail', () => {
      one.setSelection([]);
      one.setPose(a, box(9, 9));
      throw new Error('refused');
    })).toThrow('refused');
    expect(one.getSelection()).toEqual([a]);
    expect(scene.get(a)!.pose).toEqual(box(0, 0));
  });

  it('shares the one history: an edit through either is undone through the other', () => {
    const { scene, add } = makeScene();
    const a: NodeId = add();
    const one = createEditingSession(scene);
    const before = scene.historyEntries().length;
    one.setPose(a, box(40, 0));
    expect(scene.historyEntries()).toHaveLength(before + 1);
    expect(one.historyEntries()).toEqual(scene.historyEntries());
    scene.undo();
    expect(one.get(a)!.pose).toEqual(box(0, 0));
  });
});
