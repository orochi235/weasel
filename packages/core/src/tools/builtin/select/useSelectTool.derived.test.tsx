/**
 * A node that derives its path is picked where the path is, through an adapter
 * with no scene behind it: its own pose is a zero-sized placeholder.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { PATH_L, PATH_M, type Path } from '@weasel-js/geom';
import { useSelection } from 'core/selection/useSelection';
import { useSelectTool, type UseSelectToolOptions } from './useSelectTool';
import type { Action, ActionDeps } from '@weasel-js/routing';

type Pose = { x: number; y: number; width: number; height: number };
interface Item {
  id: string;
  pose: Pose;
  data?: { stroke?: { width: number; paint: string } };
  dependsOn?: string[];
  derivePath?: (node: unknown, deps: readonly ({ pose: Pose } | undefined)[]) => Path | null;
}

const line = (from: Pose, to: Pose): Path => ({
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([from.x, from.y, to.x, to.y]),
  fillRule: 'nonzero',
});

function harness(options: UseSelectToolOptions<Pose> = {}) {
  const items: Item[] = [
    { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
    { id: 'b', pose: { x: 200, y: 100, width: 10, height: 10 } },
    {
      id: 'edge', pose: { x: 0, y: 0, width: 0, height: 0 },
      data: { stroke: { width: 2, paint: '#000' } },
      dependsOn: ['a', 'b'],
      derivePath: (_n, [from, to]) => (from && to ? line(from.pose, to.pose) : null),
    },
  ];
  const adapter = {
    getNodes: () => items,
    getNode: (id: string) => items.find((n) => n.id === id),
    getParent: () => null,
    getChildren: (parentId: string | null) => (parentId === null ? items.map((n) => n.id) : []),
    getPose: (id: string) => items.find((n) => n.id === id)!.pose,
  };
  const { result } = renderHook(() => {
    const sel = useSelection({ mode: 'single' });
    return { tool: useSelectTool(adapter as never, options as never), sel };
  });
  return {
    items,
    press(x: number, y: number) {
      const tool = result.current.tool as { actions?: readonly Action[] };
      const invoker = tool.actions?.find((a) => a.id === 'select.pick')?.invoker;
      if (invoker?.timing !== 'immediate') throw new Error('select.pick missing');
      act(() => {
        invoker.run({ selection: result.current.sel } as unknown as ActionDeps, {
          world: { x, y }, mods: { alt: false, ctrl: false, meta: false, shift: false },
        });
      });
    },
    selection: () => result.current.sel.current,
  };
}

describe('useSelectTool — a derived node through a bare adapter', () => {
  it('picks it inside the box of the path it derives', () => {
    const h = harness();
    h.press(150, 50);
    expect(h.selection()).toEqual(['edge']);
  });

  it('does not pick it outside that box', () => {
    const h = harness();
    h.press(150, 150);
    expect(h.selection()).toEqual([]);
  });

  it("picks it along the line, and not beside it, under 'silhouette'", () => {
    const on = harness({ leafPicking: 'silhouette', pickTolerance: 2 });
    on.press(100, 50);
    expect(on.selection()).toEqual(['edge']);
    const beside = harness({ leafPicking: 'silhouette', pickTolerance: 2 });
    beside.press(150, 20);
    expect(beside.selection()).toEqual([]);
  });

  it('follows a dependency the adapter moved', () => {
    const h = harness();
    h.press(150, 50);
    expect(h.selection()).toEqual(['edge']);
    h.items[1] = { id: 'b', pose: { x: 0, y: 300, width: 10, height: 10 } };
    // A press on nothing leaves the selection alone, so `a` staying selected
    // is the edge no longer being where it was.
    h.press(5, 5);
    h.press(150, 50);
    expect(h.selection()).toEqual(['a']);
    h.press(0, 200);
    expect(h.selection()).toEqual(['edge']);
  });
});
