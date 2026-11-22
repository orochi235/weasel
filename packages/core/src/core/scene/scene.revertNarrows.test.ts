/**
 * Undo restores the acting session's selection; another session's is kept
 * legal only by the op's own narrowing, on both halves.
 */
import { describe, expect, it } from 'vitest';
import { createEditingSession } from './editingSession';
import { createScene } from './scene';
import { asNodeId } from './types';

type Layer = 'base' | 'top';
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function scene2() {
  return createScene<{ label: string }, Layer>({ systemLayers: [{ id: 'base' }, { id: 'top' }] });
}

describe('Scene — a revert narrows every session', () => {
  it('drops an added node from another session\'s selection when undo takes the add back', () => {
    const scene = scene2();
    const other = createEditingSession(scene);
    const id = scene.add({ kind: 'mark', id: asNodeId('n'), layer: 'base', pose: POSE, data: { label: 'n' } });
    other.setSelection([id]);
    scene.undo();
    expect(scene.get(id)).toBeUndefined();
    expect(other.getSelection()).toEqual([]);
  });

  it('drops a node from another session\'s selection when undo moves it back onto a hidden layer', () => {
    const scene = scene2();
    const other = createEditingSession(scene);
    const id = scene.add({ kind: 'mark', id: asNodeId('n'), layer: 'base', pose: POSE, data: { label: 'n' } });
    scene.setLayerVisible('base', false);
    scene.setLayer(id, 'top');
    other.setSelection([id]);
    expect(other.getSelection()).toEqual([id]);
    scene.undo();
    expect(scene.get(id)!.layer).toBe('base');
    expect(other.getSelection()).toEqual([]);
  });
});
