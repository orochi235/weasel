import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useInsertDepSource } from './insert';
import type { Scene } from '@weasel-js/core/engine';
import { pathFromD } from '@weasel-js/geom';
import { pathPaintOf } from '@weasel-js/core';

function makeScene(): Scene<unknown, string, unknown> {
  let minted = 0;
  return {
    layers: [{ id: 'default' }],
    mintId: () => `srv-${minted++}`,
    roots: [],
    renderOrder: () => [],
    get: () => undefined as never,
    batch: (_label: string, fn: () => unknown) => fn(),
  } as unknown as Scene<unknown, string, unknown>;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useInsertDepSource', () => {
  it('commits a rect via the adapter and returns an id the scene minted', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    const id = dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    expect(id).toBe('srv-0');
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Insert rect');
    expect(ops).toHaveLength(1);
  });

  it("commits a factory's node in the batch it asks for, then hands its id to `inserted`", () => {
    const applyOps = vi.fn();
    const scene = makeScene();
    const batch = vi.spyOn(scene as unknown as { batch: (l: string, fn: () => unknown, o?: unknown) => unknown }, 'batch');
    const inserted = vi.fn();
    const note = vi.fn((_bounds: unknown, extras: { text?: string }) => ({
      data: { note: extras.text ?? '' },
      batch: (id: string) => ({ join: `note:${id}` }) as never,
      inserted,
    }));
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(scene, { applyOps }, { note } as never);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    const id = dep.commit({ x: 2, y: 3, width: 40, height: 20 }, { kind: 'note', text: 'hello' });
    expect(id).toBe('srv-0');
    // The extras reach the factory, as a text/plain ingest's string does.
    expect(note).toHaveBeenCalledWith({ x: 2, y: 3, width: 40, height: 20 }, expect.objectContaining({ text: 'hello' }));
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Insert note');
    expect(ops[0].args.node.data).toEqual({ note: 'hello' });
    expect(ops[0].args.node.pose).toEqual({ x: 2, y: 3, width: 40, height: 20 });
    expect(batch).toHaveBeenCalledWith('Insert note', expect.any(Function), { join: 'note:srv-0' });
    expect(inserted).toHaveBeenCalledWith('srv-0', reg);
  });

  it('applies a factory node with no `batch` hook outside any batch', () => {
    const applyOps = vi.fn();
    const scene = makeScene();
    const batch = vi.spyOn(scene as unknown as { batch: (l: string, fn: () => unknown) => unknown }, 'batch');
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(scene, { applyOps }, { note: () => ({ data: { note: '' } }) } as never);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    (reg.get as any)('insert').commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'note' });
    expect(applyOps).toHaveBeenCalledTimes(1);
    expect(batch).not.toHaveBeenCalled();
  });

  it('keeps the minimum an insert was drawn to on a kit-built node', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const minSize = { width: 30, height: 30 };
    (reg.get as any)('insert').commit({ x: 0, y: 0, width: 40, height: 40 }, { kind: 'rect', minSize });
    expect(applyOps.mock.calls[0][0][0].args.node.data.minSize).toEqual(minSize);
  });

  it('paints a kit shape from the style its extras carry, keeping the kit geometry', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect', style: { fill: null, stroke: { color: '#f00' }, strokeWidth: 1 } });
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'line', style: { stroke: { color: '#00f' }, strokeWidth: 3 } });
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect', style: { stroke: { color: '#00f' } } });
    const data = (call: number) => applyOps.mock.calls[call][0][0].args.node.data;
    expect(data(0)).toEqual({ path: expect.anything(), fill: null, stroke: { paint: { color: '#f00' }, width: 1 } });
    expect(data(1)).toEqual({ path: expect.anything(), fill: null, stroke: { paint: { color: '#00f' }, width: 3 } });
    // A style naming no fill leaves none on the node.
    expect(data(2)).toEqual({ path: expect.anything(), stroke: { paint: { color: '#00f' }, width: 2 } });
  });

  it('cycles the palette when the extras carry no style: a fill on a shape, a stroke alone on a line or a pencil trail', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'line' });
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'pencil', samples: [{ x: 0, y: 0 }, { x: 10, y: 10 }] });
    const keys = (call: number) => Object.keys(applyOps.mock.calls[call][0][0].args.node.data).sort();
    expect(keys(0)).toEqual(['fill', 'path']);
    expect(keys(1)).toEqual(['fill', 'path', 'stroke']);
    expect(applyOps.mock.calls[1][0][0].args.node.data.fill).toBeNull();
    expect(keys(2)).toEqual(['path', 'stroke']);
    expect(applyOps.mock.calls[1][0][0].args.node.data.stroke.width).toBe(2);
  });

  it('leaves a line unfilled whatever fill its style names, so an action reading its paint finds a stroke alone', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const style = { fill: { color: '#0f0' }, stroke: { color: '#00f' }, strokeWidth: 3 };
    (reg.get as any)('insert').commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'line', style });
    const { data } = applyOps.mock.calls[0][0][0].args.node;
    expect(pathPaintOf(data)).toEqual({ fill: null, stroke: { paint: { color: '#00f' }, width: 3 } });
  });

  it('inserts a pen path as kind=path: filled and stroked when closed, stroke alone when open', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    const path = pathFromD('M 10 20 L 40 20 L 40 60');
    const bounds = { x: 10, y: 20, width: 30, height: 40 };
    dep.commit(bounds, { kind: 'path', path, closed: true });
    dep.commit(bounds, { kind: 'path', path, closed: false });
    const nodes = applyOps.mock.calls.map(([ops]) => ops[0].args.node);
    expect(nodes[0]).toMatchObject({ pose: bounds, data: { path } });
    expect(nodes[0].data.fill).toBeTruthy();
    expect(nodes[0].data.stroke).toBeTruthy();
    expect(nodes[1].data.fill).toBeNull();
    expect(nodes[1].data.stroke).toBeTruthy();
  });

  it('builds the insert without applying it, for a caller with more to batch', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const built = (reg.get as any)('insert').build({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    expect(applyOps).not.toHaveBeenCalled();
    expect(built.id).toBe('srv-0');
    expect(built.ops.map((op: { name: string }) => op.name)).toEqual(['insert']);
    expect(built.ops[0].args.node.id).toBe('srv-0');
  });

  it('returns null and warns when the kind has no factory', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps });
      return null;
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('insert');
    const id = dep.commit({ x: 0, y: 0, width: 1, height: 1 }, { kind: 'totally-unknown' });
    expect(id).toBeNull();
    expect(applyOps).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('insertNodeFactories'));
    warn.mockRestore();
  });
});
