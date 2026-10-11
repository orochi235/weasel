import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import { useInsertDepSource } from './insert';
import type { Scene } from 'core/scene/types';

function makeScene(): Scene<unknown, string, unknown> {
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => [],
    get: () => undefined as never,
  } as unknown as Scene<unknown, string, unknown>;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useInsertDepSource', () => {
  it('commits a rect via the adapter and returns a kit-prefixed id', () => {
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
    expect(id).toMatch(/^kit-rect-/);
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
    expect(id).toMatch(/^kit-text-/);
    expect(applyOps).toHaveBeenCalledTimes(1);
    const [ops, label] = applyOps.mock.calls[0];
    expect(label).toBe('Insert text');
    // The kit:text painter matches on `data.text != null`; an empty string is
    // a valid, selectable, editable text node (you type into it after).
    expect(ops[0].args.node.data).toEqual({ text: '' });
    expect(ops[0].args.node.pose).toEqual({ x: 2, y: 3, width: 40, height: 20 });
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
    expect(applyOps.mock.calls[0][0][0].args.node.data).toEqual({ text: 'hello' });
  });

  it('paints a kit shape from the `paint` option, keeping the kit geometry', () => {
    const applyOps = vi.fn();
    let reg!: DepRegistry;
    const paint = vi.fn((kind: string, _seq: number) =>
      kind === 'line' ? { stroke: { paint: { color: '#00f' }, width: 3 } } : { fill: null, stroke: { paint: { color: '#f00' }, width: 1 } },
    );
    function Wire() {
      useInsertDepSource(makeScene(), { applyOps }, undefined, paint);
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
    const data = (call: number) => applyOps.mock.calls[call][0][0].args.node.data;
    expect(data(0)).toEqual({ path: expect.anything(), fill: null, stroke: { paint: { color: '#f00' }, width: 1 } });
    expect(data(1)).toEqual({ path: expect.anything(), stroke: { paint: { color: '#00f' }, width: 3 } });
    expect(paint.mock.calls.map(([kind, seq]) => [kind, seq])).toEqual([['rect', 1], ['line', 2]]);
  });

  it('cycles the palette when no `paint` is given: a fill on a shape, a stroke as well on a line, a stroke alone on a pencil trail', () => {
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
    expect(keys(2)).toEqual(['path', 'stroke']);
    expect(applyOps.mock.calls[1][0][0].args.node.data.stroke.width).toBe(2);
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
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
