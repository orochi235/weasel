import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useInsertDepSource } from './insert';
import type { Scene } from 'core/scene/types';
import { pathFromD } from '@weasel-js/geom';
import { pathPaintOf } from '../nodeShapes/nodePaint';

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

  it('commits an empty text node for kind=text (the built-in text tool drag)', () => {
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
    const id = dep.commit({ x: 2, y: 3, width: 40, height: 20 }, { kind: 'text' });
    expect(id).toBe('srv-0');
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Insert text');
    // The kit:text painter matches on `data.text != null`; an empty string is
    // a valid, selectable, editable text node (you type into it after).
    expect(ops[0].args.node.data).toEqual({ text: '', fill: { paint: { kind: 'solid', color: '#000' } } });
    expect(ops[0].args.node.pose).toEqual({ x: 2, y: 3, width: 40, height: 20 });
  });

  it('sets new text in the fill its style names, none included', () => {
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
    dep.commit({ x: 0, y: 0, width: 40, height: 20 }, { kind: 'text', style: { fill: { color: '#f00' } } });
    dep.commit({ x: 0, y: 0, width: 40, height: 20 }, { kind: 'text', style: { fill: null } });
    const data = (call: number) => applyOps.mock.calls[call][0][0].args.node.data;
    expect(data(0)).toEqual({ text: '', fill: { paint: { color: '#f00' } } });
    expect(data(1)).toEqual({ text: '', fill: null });
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

  it('threads text content through from extras.text (e.g. a text/plain ingest)', () => {
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
    dep.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'text', text: 'hello' });
    expect(applyOps.mock.calls[0][0][0].args.node.data).toEqual({ text: 'hello', fill: { paint: { kind: 'solid', color: '#000' } } });
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
