import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { commitOps, createScene, DepRegistryProvider, useDepRegistry, useDepSource, type ActionDeps, type InsertDep, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { FLOWCHART_STENCILS, stencilBuild, stencilKind } from './stencil';
import { NODE } from './fromData';
import { CONTAINER_STENCILS, lanesOf } from './containers/containerStencils';
import { useStencilInsert, useStencilTool, type StencilInsertOptions } from './stencilTool';

const byId = (id: string) => FLOWCHART_STENCILS.find((s) => s.id === id)!;

function idMinter(prefix = 'n'): () => string {
  let n = 0;
  return () => `${prefix}${++n}`;
}

interface InsertedNode {
  id: string;
  kind: string;
  parent?: string | null;
  pose: RectPose;
  data: { diagram?: { outline?: unknown }; text?: string; fill?: { paint: { color: string } }; stroke?: { paint: { color: string }; width: number } };
}
const insertedNodes = (ops: { name: string; args: unknown }[]) =>
  ops.map((op) => {
    expect(op.name).toBe('insert');
    return (op.args as { node: InsertedNode }).node;
  });

describe('stencilBuild', () => {
  it('turns a click on a diamond into a container at the stencil size plus one text row', () => {
    const diamond = byId('decision');
    expect(diamond.outline).toBe('diamond');
    const { id, ops } = stencilBuild(diamond, { x: 10, y: 20, width: 0, height: 0 }, { layer: 'main', newId: idMinter() });
    const [box, text, ...rest] = insertedNodes(ops as never);
    expect(rest).toEqual([]);
    expect(box!.id).toBe(id);
    expect(box!.kind).toBe('container');
    expect(box!.data.diagram?.outline).toBe('diamond');
    expect(box!.pose.width).toBeGreaterThanOrEqual(diamond.size.width);
    expect(box!.pose.height).toBeGreaterThanOrEqual(diamond.size.height);
    expect(box!.pose.x + box!.pose.width / 2).toBe(10);
    expect(box!.pose.y + box!.pose.height / 2).toBe(20);
    expect(text!.kind).toBe('leaf');
    expect(text!.parent).toBe(id);
    expect(text!.data.text).toBe('');
    expect((text!.data as { style?: { align?: string } }).style?.align).toBe('center');
  });

  it('keeps a dragged box where it was drawn', () => {
    const { ops } = stencilBuild(byId('process'), { x: 0, y: 0, width: 300, height: 200 }, { layer: 'main', newId: idMinter() });
    expect(insertedNodes(ops as never)[0]!.pose).toMatchObject({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('inserts as one undo entry', () => {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    const { id, ops } = stencilBuild(byId('decision'), { x: 10, y: 20, width: 0, height: 0 }, { layer: 'main', newId: () => scene.mintId() });
    commitOps({ scene } as unknown as ActionDeps, ops, 'Insert Decision');
    expect(scene.get(id as never)?.kind).toBe('container');
    expect(scene.childrenOf(id as never)).toHaveLength(1);
    expect(scene.undo()).toBe(true);
    expect(scene.get(id as never)).toBeUndefined();
    expect([...scene.roots]).toEqual([]);
    expect(scene.canUndo()).toBe(false);
  });

  it('builds every flowchart stencil', () => {
    expect(FLOWCHART_STENCILS.map((s) => s.id)).toEqual(
      ['process', 'decision', 'terminal', 'data', 'manual', 'preparation', 'connector'],
    );
    for (const s of FLOWCHART_STENCILS) {
      const { ops } = stencilBuild(s, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'main', newId: idMinter(s.id) });
      expect(insertedNodes(ops as never)[0]!.data.diagram?.outline).toBe(s.outline);
    }
  });

  it("colors the body and its text with diagramScene's node style, or the style it is given", () => {
    const colors = (style?: typeof NODE) => {
      const [box, text] = insertedNodes(stencilBuild(byId('process'), { x: 0, y: 0, width: 0, height: 0 }, {
        layer: 'main', newId: idMinter(), ...(style ? { style } : {}),
      }).ops as never);
      return [box!.data.fill?.paint.color, box!.data.stroke?.paint.color, box!.data.stroke?.width, text!.data.fill?.paint.color];
    };
    expect(colors()).toEqual([NODE.fill, NODE.stroke, 2, NODE.text]);
    expect(colors({ fill: '#fff', stroke: '#333', text: '#111', strokeWidth: 1.5 })).toEqual(['#fff', '#333', 1.5, '#111']);
  });

  it('sets its text rows in the face it is given', () => {
    const [, text] = insertedNodes(stencilBuild(byId('process'), { x: 0, y: 0, width: 0, height: 0 }, {
      layer: 'main', newId: idMinter(), font: { fontFamily: 'serif', fontSize: 15 },
    }).ops as never);
    expect((text!.data as { style?: { fontFamily: string; fontSize: number } }).style).toMatchObject({ fontFamily: 'serif', fontSize: 15 });
  });
});

describe('useStencilTool', () => {
  it('binds a drag to insert with the stencil kind', () => {
    const { result } = renderHook(() => useStencilTool(byId('process')));
    expect(result.current.id).toBe('stencil:process');
    const insert = result.current.bindings!.find((b) => b.actionId === 'insert')!;
    expect(insert.spec).toEqual({ kind: 'drag' });
    expect((insert.opts as { params: { kind: string } }).params.kind).toBe(stencilKind('process'));
    expect(stencilKind('process')).toBe('stencil:process');
  });
});

describe('useStencilInsert', () => {
  function insertDep(opts?: StencilInsertOptions, under?: InsertDep) {
    const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    const wrapper = ({ children }: { children: ReactNode }) => createElement(DepRegistryProvider, null, children);
    const { result } = renderHook(() => {
      useDepSource('scene', () => scene as never);
      if (under) useDepSource('insert', () => under);
      useStencilInsert(FLOWCHART_STENCILS, opts);
      return useDepRegistry();
    }, { wrapper });
    return { scene, dep: result.current.get('insert')! };
  }

  it('commits a stencil kind as a body in one undo entry', () => {
    const { scene, dep } = insertDep();
    const id = dep.commit({ x: 0, y: 0, width: 0, height: 0 }, { kind: stencilKind('terminal') } as never);
    expect(id).not.toBeNull();
    expect(scene.get(id!)?.kind).toBe('container');
    expect(scene.historyEntries().map((e) => e.label)).toEqual(['Insert Terminal']);
    expect(scene.undo()).toBe(true);
    expect(scene.get(id!)).toBeUndefined();
  });

  it('hands a kind no stencil names to the insert dep it displaced', () => {
    const under = { commit: vi.fn(() => 'r1' as never), build: vi.fn(() => null), layer: () => 'main' } satisfies InsertDep;
    const { dep } = insertDep(undefined, under);
    const bounds = { x: 0, y: 0, width: 10, height: 10 };
    expect(dep.commit(bounds, { kind: 'rect' } as never)).toBe('r1');
    expect(under.commit).toHaveBeenCalledWith(bounds, { kind: 'rect' }, undefined);
    dep.build!(bounds, { kind: 'rect' } as never);
    expect(under.build).toHaveBeenCalledTimes(1);
    dep.commit(bounds, { kind: stencilKind('process') } as never);
    expect(under.commit).toHaveBeenCalledTimes(1);
  });

  it('inserts nothing for a kind no stencil names when nothing is beneath it', () => {
    const { scene, dep } = insertDep();
    expect(dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' } as never)).toBeNull();
    expect([...scene.roots]).toEqual([]);
  });

  it('builds bodies in the style it is given', () => {
    const { scene, dep } = insertDep({ style: { fill: '#fafafa', stroke: '#222', text: '#000' } });
    const id = dep.commit({ x: 0, y: 0, width: 0, height: 0 }, { kind: stencilKind('process') } as never)!;
    expect((scene.get(id)!.data as { fill: { paint: { color: string } } }).fill.paint.color).toBe('#fafafa');
  });

  it('draws container stencils, and puts a shape drawn in a lane in that lane', () => {
    const { scene, dep } = insertDep({ containers: CONTAINER_STENCILS });
    const pool = dep.commit({ x: 0, y: 0, width: 480, height: 240 }, { kind: stencilKind('pool-rows') } as never)!;
    expect(scene.historyEntries().map((e) => e.label)).toEqual(['Insert Pool (rows)']);
    const [, second] = lanesOf(scene as never, pool);
    const shape = dep.commit({ x: 200, y: 180, width: 0, height: 0 }, { kind: stencilKind('process') } as never)!;
    expect(scene.get(shape)!.parent).toBe(second);
    const inner = dep.commit({ x: 200, y: 60, width: 0, height: 0 }, { kind: stencilKind('pool-columns') } as never)!;
    expect(scene.get(inner)!.parent).toBeNull();
  });
});
