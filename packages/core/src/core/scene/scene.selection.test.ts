import { describe, it, expect, vi } from 'vitest';
import { createScene } from './scene';
import { asNodeId } from './types';
import type { NodeId } from './types';
import { createTransformOp } from 'core/ops/transform';

interface Data { label: string }
type Layer = 'default';
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function makeScene() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'default' }] });
  const add = (id: string) =>
    scene.add({ id: asNodeId(id), kind: 'leaf', layer: 'default', pose: { ...POSE }, data: { label: id } });
  return { scene, add };
}

const ids = (list: string[]): NodeId[] => list.map(asNodeId);

describe('Scene — selection', () => {
  it('round-trips and notifies', () => {
    const { scene } = makeScene();
    const listener = vi.fn();
    scene.subscribe(listener);

    scene.setSelection(ids(['a', 'b']));

    expect(scene.getSelection()).toEqual(ids(['a', 'b']));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('a selection change is not an undo step', () => {
    const { scene } = makeScene();
    scene.setSelection(ids(['a']));
    scene.setSelection(ids(['b']));

    expect(scene.canUndo()).toBe(false);
    expect(scene.historyEntries()).toHaveLength(0);
  });

  it('stays out of toJSON', () => {
    const { scene, add } = makeScene();
    add('a');
    scene.setSelection(ids(['a']));

    expect(JSON.stringify(scene.toJSON())).not.toContain('selection');
  });

  it('undo restores the selection a scene mutation was made under', () => {
    const { scene, add } = makeScene();
    add('a');
    scene.setSelection(ids(['a']));

    scene.setPose(asNodeId('a'), { ...POSE, x: 50 });
    scene.setSelection(ids([]));

    scene.undo();
    expect(scene.getSelection()).toEqual(ids(['a']));
  });

  it('undo restores the selection an applyBatch was made under', () => {
    const { scene, add } = makeScene();
    add('a');
    scene.setSelection(ids(['a', 'b']));

    scene.applyBatch(
      [createTransformOp({ id: asNodeId('a'), from: { ...POSE }, to: { ...POSE, x: 20 } })],
      'move',
      { setPose: (id: string, pose: unknown) => { scene.setPose(asNodeId(id), pose as typeof POSE); } },
    );
    scene.setSelection(ids(['other']));

    scene.undo();
    expect(scene.getSelection()).toEqual(ids(['a', 'b']));
  });

  it('undo restores the selection a scene.batch was opened under', () => {
    const { scene, add } = makeScene();
    add('a');
    add('b');
    scene.setSelection(ids(['a', 'b']));

    scene.batch('collapse', () => {
      scene.remove(asNodeId('a'));
      scene.remove(asNodeId('b'));
      scene.setSelection(ids(['c']));
    });

    scene.undo();
    expect(scene.get(asNodeId('a'))).toBeDefined();
    expect(scene.getSelection()).toEqual(ids(['a', 'b']));
  });

  it('redo returns the selection the user had before undoing', () => {
    const { scene, add } = makeScene();
    add('a');
    scene.setSelection(ids(['a']));
    scene.setPose(asNodeId('a'), { ...POSE, x: 50 });
    scene.setSelection(ids(['after']));

    scene.undo();
    scene.redo();

    expect(scene.getSelection()).toEqual(ids(['after']));
  });

  it('jumpToHistoryIndex restores the selection of the entry it lands on', () => {
    const { scene, add } = makeScene();
    add('a');
    scene.setSelection(ids(['first']));
    scene.setPose(asNodeId('a'), { ...POSE, x: 10 });
    scene.setSelection(ids(['second']));
    scene.setPose(asNodeId('a'), { ...POSE, x: 20 });

    // Landing after entry 2 undoes only entry 3, whose selection was 'second'.
    scene.jumpToHistoryIndex(2);
    expect(scene.getSelection()).toEqual(ids(['second']));

    scene.jumpToHistoryIndex(1);
    expect(scene.getSelection()).toEqual(ids(['first']));
  });
});
