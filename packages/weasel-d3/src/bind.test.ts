import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene } from '@orochi235/weasel';
import { d3Bind } from './bind';

interface Datum {
  id: string;
  label: string;
  x: number;
}
interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}

function setupScene() {
  const { result } = renderHook(() =>
    useScene<{ label: string }, 'graph', Pose>({
      systemLayers: [{ id: 'graph' }],
      initial: [],
    }),
  );
  return result;
}

describe('d3Bind — diff and op emission', () => {
  it('enter: data with no scene leaves emits one add per datum', () => {
    const scene = setupScene();
    const data: Datum[] = [
      { id: 'a', label: 'A', x: 10 },
      { id: 'b', label: 'B', x: 20 },
    ];
    act(() => {
      d3Bind(scene.current, data, { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.nodes.size).toBe(2);
    expect(scene.current.get('a' as never)?.data).toEqual({ label: 'A' });
    expect(scene.current.get('b' as never)?.pose).toEqual({ x: 20, y: 0, width: 10, height: 10 });
  });

  it('update: re-binding with changed pose patches the existing leaf', () => {
    const scene = setupScene();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', label: 'A', x: 10 }] as Datum[], { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    act(() => {
      d3Bind(scene.current, [{ id: 'a', label: 'A', x: 99 }] as Datum[], { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.nodes.size).toBe(1);
    expect(scene.current.get('a' as never)?.pose.x).toBe(99);
  });

  it('exit: leaves absent from new data are removed', () => {
    const scene = setupScene();
    act(() => {
      d3Bind(
        scene.current,
        [{ id: 'a', label: 'A', x: 10 }, { id: 'b', label: 'B', x: 20 }] as Datum[],
        { key: (d) => d.id },
      )
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.nodes.size).toBe(2);
    act(() => {
      d3Bind(scene.current, [{ id: 'b', label: 'B', x: 20 }] as Datum[], { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.nodes.size).toBe(1);
    expect(scene.current.get('a' as never)).toBeUndefined();
    expect(scene.current.get('b' as never)).toBeDefined();
  });

  it('mixed: enter + update + exit in one join is one undo entry', () => {
    const scene = setupScene();
    act(() => {
      d3Bind(
        scene.current,
        [{ id: 'a', label: 'A', x: 10 }, { id: 'b', label: 'B', x: 20 }] as Datum[],
        { key: (d) => d.id },
      )
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    // b stays (update), c is new (enter), a goes away (exit).
    act(() => {
      d3Bind(
        scene.current,
        [{ id: 'b', label: 'B!', x: 21 }, { id: 'c', label: 'C', x: 30 }] as Datum[],
        { key: (d) => d.id },
      )
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.nodes.size).toBe(2);
    expect(scene.current.get('a' as never)).toBeUndefined();
    expect(scene.current.get('b' as never)?.pose.x).toBe(21);
    expect(scene.current.get('b' as never)?.data).toEqual({ label: 'B!' });
    expect(scene.current.get('c' as never)?.data).toEqual({ label: 'C' });

    // One undo step rewinds the whole second join (b restored, c gone, a back).
    act(() => {
      scene.current.undo();
    });
    expect(scene.current.nodes.size).toBe(2);
    expect(scene.current.get('a' as never)).toBeDefined();
    expect(scene.current.get('b' as never)?.pose.x).toBe(20);
    expect(scene.current.get('c' as never)).toBeUndefined();
  });

  it('idempotent: re-binding with unchanged data produces no real change', () => {
    const scene = setupScene();
    const data: Datum[] = [{ id: 'a', label: 'A', x: 10 }];
    act(() => {
      d3Bind(scene.current, data, { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    const beforePose = scene.current.get('a' as never)?.pose;
    act(() => {
      d3Bind(scene.current, data, { key: (d) => d.id })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(scene.current.get('a' as never)?.pose).toEqual(beforePose);
  });

  it('respects custom layer option', () => {
    const { result } = renderHook(() =>
      useScene<{ label: string }, 'a' | 'b', Pose>({
        systemLayers: [{ id: 'a' }, { id: 'b' }],
        initial: [],
      }),
    );
    act(() => {
      d3Bind(result.current, [{ id: 'x', label: 'X', x: 5 }] as Datum[], {
        key: (d) => d.id,
        layer: 'b',
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data((d) => ({ label: d.label }))
        .join();
    });
    expect(result.current.get('x' as never)?.layer).toBe('b');
  });

  it('throws when no pose() is set and data is non-empty', () => {
    const scene = setupScene();
    expect(() => {
      d3Bind(scene.current, [{ id: 'a', label: 'A', x: 10 }] as Datum[], { key: (d) => d.id })
        .data((d) => ({ label: d.label }))
        .join();
    }).toThrow(/pose/);
  });
});

describe('d3Bind selection — filter / each', () => {
  it('returns merged selection (enter + update) in data order', () => {
    const scene = setupScene();
    const data: Datum[] = [
      { id: 'a', label: 'A', x: 10 },
      { id: 'b', label: 'B', x: 20 },
      { id: 'c', label: 'C', x: 30 },
    ];
    let sel: ReturnType<typeof binding.join>;
    const binding = d3Bind(scene.current, data, { key: (d) => d.id })
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
      .data((d) => ({ label: d.label }));
    act(() => {
      sel = binding.join();
    });
    expect(sel!.ids).toEqual(['a', 'b', 'c']);
    expect(sel!.data).toEqual(data);
  });

  it('filter() narrows to matching data without re-mutating scene', () => {
    const scene = setupScene();
    let sel: ReturnType<typeof binding.join>;
    const binding = d3Bind(
      scene.current,
      [
        { id: 'a', label: 'A', x: 10 },
        { id: 'b', label: 'B', x: 20 },
        { id: 'c', label: 'C', x: 30 },
      ] as Datum[],
      { key: (d) => d.id },
    )
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
      .data((d) => ({ label: d.label }));
    act(() => {
      sel = binding.join();
    });
    const filtered = sel!.filter((d) => d.x > 15);
    expect(filtered.ids).toEqual(['b', 'c']);
    expect(filtered.data.map((d) => d.id)).toEqual(['b', 'c']);
    // Scene state unchanged by filter.
    expect(scene.current.nodes.size).toBe(3);
  });

  it('each() walks the selection in order', () => {
    const scene = setupScene();
    const data: Datum[] = [
      { id: 'a', label: 'A', x: 10 },
      { id: 'b', label: 'B', x: 20 },
    ];
    let sel: ReturnType<typeof binding.join>;
    const binding = d3Bind(scene.current, data, { key: (d) => d.id })
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
      .data((d) => ({ label: d.label }));
    act(() => {
      sel = binding.join();
    });
    const seen: Array<{ id: string; i: number }> = [];
    sel!.each((d, id, i) => seen.push({ id: d.id + ':' + id, i }));
    expect(seen).toEqual([
      { id: 'a:a', i: 0 },
      { id: 'b:b', i: 1 },
    ]);
  });

  it('transition() throws "not implemented" until Phase 2', () => {
    const scene = setupScene();
    let sel: ReturnType<typeof binding.join>;
    const binding = d3Bind(scene.current, [{ id: 'a', label: 'A', x: 10 }] as Datum[], {
      key: (d) => d.id,
    })
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
      .data((d) => ({ label: d.label }));
    act(() => {
      sel = binding.join();
    });
    expect(() => sel!.transition()).toThrow(/not implemented/);
  });
});
