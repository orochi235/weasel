/**
 * The default edge-label edit adds a label and then types into it; the add and the first commit are one undo
 * entry, so an undo after typing takes the label away rather than leaving an empty one on the edge.
 */
import { act, renderHook } from '@testing-library/react';
import { createScene, useSceneTextEdit, type ActionDeps, type Scene } from '@weasel-js/core';
import { afterEach, describe, expect, it } from 'vitest';
import { EDGE_DERIVE_PATH } from './edge';
import { dropEmptyEdgeLabel, editEdgeLabelAction } from './edgeLabel';

interface Rect { x: number; y: number; width: number; height: number }
type Sc = Scene<{ text?: string }, 'main', Rect>;

function setup() {
  const scene: Sc = createScene({ systemLayers: [{ id: 'main' }] });
  for (const [id, x] of [['a', 0], ['b', 300]] as const) {
    scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} } as never });
  }
  scene.add({
    id: 'e1' as never, kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: { nodeId: 'a' }, to: { nodeId: 'b' }, router: 'straight' } } as never,
    dependsOn: ['a' as never, 'b' as never], derivePath: EDGE_DERIVE_PATH as never,
  });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const hook = renderHook(() => useSceneTextEdit(scene, container, { onEnd: (id) => dropEmptyEdgeLabel(scene as never, id) }));
  const entries = scene.historyEntries().length;
  const open = () => {
    const { invoker } = editEdgeLabelAction();
    if (invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
    const deps = { scene, nodeAtPoint: () => 'e1', textEdit: { startEdit: hook.result.current.startEdit } } as unknown as ActionDeps;
    act(() => { invoker.run(deps, { world: { x: 150, y: 20 } }); });
  };
  const type = (text: string) => {
    const overlay = container.querySelector<HTMLElement>('div[contenteditable="true"]')!;
    overlay.textContent = text;
    act(() => { overlay.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  return { scene, hook, entries, open, type };
}

afterEach(() => { document.body.innerHTML = ''; });

const label = (scene: Sc) => scene.get('e1/label' as never);

describe('the default edge-label edit', () => {
  it('adds a label and commits its first text as one undo entry', () => {
    const { scene, hook, entries, open, type } = setup();
    open();
    type('weight');
    act(() => hook.result.current.commitEdit());
    expect((label(scene)!.data as { text: string }).text).toBe('weight');
    expect(scene.historyEntries()).toHaveLength(entries + 1);
    scene.undo();
    expect(label(scene)).toBeUndefined();
    scene.redo();
    expect((label(scene)!.data as { text: string }).text).toBe('weight');
  });

  it('keeps a later edit of the label its own entry', () => {
    const { scene, hook, entries, open, type } = setup();
    open();
    type('weight');
    act(() => hook.result.current.commitEdit());
    open();
    type('cost');
    act(() => hook.result.current.commitEdit());
    expect(scene.historyEntries()).toHaveLength(entries + 2);
    scene.undo();
    expect((label(scene)!.data as { text: string }).text).toBe('weight');
  });

  it('removes a new label ended empty, and no undo or redo brings it back', () => {
    const { scene, hook, entries, open } = setup();
    open();
    expect(label(scene)).toBeDefined();
    act(() => hook.result.current.commitEdit());
    expect(label(scene)).toBeUndefined();
    expect(scene.historyEntries()).toHaveLength(entries + 1);
    scene.undo();
    expect(label(scene)).toBeUndefined();
    scene.redo();
    expect(label(scene)).toBeUndefined();
  });

  it('removes a new label whose text was typed and cleared, in the same entry', () => {
    const { scene, hook, entries, open, type } = setup();
    open();
    type('w');
    type('');
    act(() => hook.result.current.commitEdit());
    expect(label(scene)).toBeUndefined();
    expect(scene.historyEntries()).toHaveLength(entries + 1);
    scene.undo();
    expect(label(scene)).toBeUndefined();
  });
});
