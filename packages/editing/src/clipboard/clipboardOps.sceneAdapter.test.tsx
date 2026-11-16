/** `useClipboardOps` over `sceneToAdapter`'s clipboard seam: a copied subtree pastes back as fresh nodes in one undo step. */
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene } from '@weasel-js/core/engine';
import { sceneToAdapter, type NodeId } from '@weasel-js/core';
import { useClipboardOps } from './clipboardOps';

interface Data { label: string; }
interface Pose { x: number; y: number; width: number; height: number; }

function makeScene() {
  return createScene<Data, 'bg' | 'fg', Pose>({
    systemLayers: [{ id: 'bg' }, { id: 'fg' }],
  });
}

describe('useClipboardOps over sceneToAdapter', () => {
  it('round-trips copy → paste through useClipboardOps: subtree inserted, one undo entry, selection = new ids', () => {
    const scene = makeScene();
    const p = scene.add({ kind: 'group', layer: 'bg', pose: { x: 10, y: 10, width: 100, height: 100 }, data: { label: 'p' } });
    const c1 = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 5, y: 5, width: 5, height: 5 }, data: { label: 'c1' }, parent: p });
    const c2 = scene.add({ kind: 'mark', layer: 'bg', pose: { x: 20, y: 20, width: 5, height: 5 }, data: { label: 'c2' }, parent: p });
    let selection: string[] = [p];
    const adapter = sceneToAdapter(scene, {
      selection: { get: () => selection, set: (ids) => { selection = [...ids]; } },
    });
    const { result } = renderHook(() =>
      useClipboardOps(adapter, { getSelection: () => selection as NodeId[] }),
    );

    act(() => { result.current.copy(); });
    const nodeCountBefore = scene.nodes.size;
    const idsBefore = new Set(scene.nodes.keys());
    const entriesBefore = scene.historyEntries().length;
    act(() => { result.current.paste(); });

    // The whole subtree exists as fresh nodes.
    expect(scene.nodes.size).toBe(nodeCountBefore + 3);
    const newIds = [...scene.nodes.keys()].filter((id) => !idsBefore.has(id));
    expect(newIds).toHaveLength(3);
    const newContainer = newIds.map((id) => scene.get(id)!).find((n) => n.kind === 'group')!;
    expect(newContainer).toBeDefined();
    expect(scene.childrenOf(newContainer.id)).toHaveLength(2);
    for (const cid of scene.childrenOf(newContainer.id)) {
      expect(newIds).toContain(cid);
      expect(scene.get(cid)!.parent).toBe(newContainer.id);
    }
    // Originals untouched.
    for (const id of [p, c1, c2]) expect(scene.nodes.has(id)).toBe(true);

    // Selection moved to the pasted ids.
    expect([...selection].sort()).toEqual(newIds.map(String).sort());

    // ONE undo entry for the whole paste; undo removes the entire subtree.
    expect(scene.historyEntries().length).toBe(entriesBefore + 1);
    scene.undo();
    expect(scene.nodes.size).toBe(nodeCountBefore);
    for (const id of newIds) expect(scene.nodes.has(id)).toBe(false);
  });
});
