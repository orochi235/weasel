import { describe, expect, it, vi } from 'vitest';
import { createScene, deletePreset, type ActionDeps, type RectPose } from '@weasel-js/core';
import { reportDeleteAction } from './diagramEditing';
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
    const action = deletePreset.actions!.find((a) => a.id === 'delete')!;
    const invoker = action.invoker as { run: (deps: ActionDeps) => void };
    invoker.run({ scene, selection } as unknown as ActionDeps);

    for (const id of ['a', edge, label]) expect(scene.get(id as never)).toBeUndefined();
    expect(scene.get('b' as never)).toBeDefined();

    expect(scene.undo()).toBe(true);
    for (const id of ['a', edge, label]) expect(scene.get(id as never)).toBeDefined();
    expect(scene.canUndo()).toBe(false);
  });
});

describe("DiagramView's report-only delete", () => {
  const GROUPED: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
    edges: [{ from: 'G', to: 'c' }, { from: 'a', to: 'b' }],
    groups: [{ id: 'G', members: ['a', 'b'] }],
  };

  function reportFor(selected: string[]) {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      initial: diagramScene(GROUPED, { layout: 'none' }) as never,
      registry: withDiagramRegistry(),
    });
    const report = vi.fn();
    const action = reportDeleteAction(report);
    const selection = { get: () => selected, set: vi.fn() };
    (action.invoker as { run: (deps: ActionDeps) => void }).run({ scene, selection, applyOps: vi.fn() } as unknown as ActionDeps);
    return { report, scene, selection };
  }

  it('reports a group member and its own edges, not the group or the edges on it', () => {
    const { report, scene, selection } = reportFor(['a']);
    expect(report).toHaveBeenCalledWith({ nodes: ['a'], edges: [edgeIdOf({ from: 'a', to: 'b' })] });
    expect(scene.get('a' as never)).toBeDefined();
    expect(selection.set).not.toHaveBeenCalled();
  });

  it('reports a selected group, not its members', () => {
    const { report } = reportFor(['G']);
    expect(report).toHaveBeenCalledWith({ nodes: ['G'], edges: [edgeIdOf({ from: 'G', to: 'c' })] });
  });

  it('reports nothing when nothing selected is data', () => {
    expect(reportFor(['a/nope']).report).not.toHaveBeenCalled();
  });
});
