import { describe, expect, it, vi } from 'vitest';
import { createScene, editPreset, type ActionDeps, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
  edges: [{ from: 'a', to: 'b', label: 'go' }],
};

describe("core's delete on a diagram", () => {
  it('takes a node, its edge and the edge label as one undo entry', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: diagramScene(DATA, { layout: 'none' }) as never,
      registry: withDiagramRegistry(),
    });
    const edge = edgeIdOf(DATA.edges[0]!);
    const label = `${edge}/label`;
    expect(scene.get(label as never)).toBeDefined();
    expect(scene.canUndo()).toBe(false);

    let ids = ['a'];
    const selection = {
      get: () => ids,
      set: vi.fn((next: string[]) => { ids = next; }),
      adapterMethods: { getSelection: () => ids, setSelection: (next: string[]) => { ids = next; } },
    };
    const action = editPreset.actions!.find((a) => a.id === 'delete')!;
    const invoker = action.invoker as { run: (deps: ActionDeps) => void };
    invoker.run({ scene, selection } as unknown as ActionDeps);

    for (const id of ['a', edge, label]) expect(scene.get(id as never)).toBeUndefined();
    expect(scene.get('b' as never)).toBeDefined();

    expect(scene.undo()).toBe(true);
    for (const id of ['a', edge, label]) expect(scene.get(id as never)).toBeDefined();
    expect(scene.canUndo()).toBe(false);
  });
});
