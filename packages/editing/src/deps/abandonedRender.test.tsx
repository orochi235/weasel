/**
 * The editing deps read their inputs at dispatch time, as core's do: a render React throws away leaves those
 * reads on the last committed inputs, never on the abandoned render's.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { SelectionApi } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION, type Scene } from '@weasel-js/core';
import { useAreaSelectDepSource } from './areaSelect';
import { useLassoSelectDepSource } from './lassoSelect';
import { useInsertDepSource } from './insert';
import { useResizePolicyDepSource } from './resizePolicy';

afterEach(() => { cleanup(); });

/** Commits `use(a)`, abandons a render of `use(b)`, and hands back the registry. */
function registryAfterAbandon<P>(a: P, b: P, use: (p: P) => void): DepRegistry {
  let reg!: DepRegistry;
  function Wire({ p }: { p: P }) {
    use(p);
    return null;
  }
  function Capture() {
    reg = useDepRegistry();
    return null;
  }
  renderThenAbandon(a, b, (p) => (
    <DepRegistryProvider>
      <Wire p={p} />
      <Capture />
    </DepRegistryProvider>
  ));
  return reg;
}

const dep = (reg: DepRegistry, name: string): any => (reg.get as (n: string) => unknown)(name);

const selectionOf = (ids: string[]) => ({ current: ids, set: vi.fn() }) as unknown as SelectionApi;
const sceneWith = (get: (id: string) => unknown = () => undefined) =>
  ({
    layers: [{ id: 'default' }], get, renderOrderNodes: () => [], layoutOf: () => null, onReflow: () => () => {},
    mintId: () => 'minted',
    roots: [],
    composition: IDENTITY_POSE_COMPOSITION,
  }) as unknown as Scene<unknown, string, unknown>;

describe('editing dep sources after an abandoned render', () => {
  it('areaSelect reads the committed selection', () => {
    const scene = sceneWith();
    const reg = registryAfterAbandon(selectionOf(['a']), selectionOf(['b']), (s) => {
      useAreaSelectDepSource(scene, s);
    });
    expect(dep(reg, 'areaSelect').getSelection()).toEqual(['a']);
  });

  it('lassoSelect reads the committed selection', () => {
    const scene = sceneWith();
    const reg = registryAfterAbandon(selectionOf(['a']), selectionOf(['b']), (s) => {
      useLassoSelectDepSource(scene, s);
    });
    expect(dep(reg, 'lassoSelect').getSelection()).toEqual(['a']);
  });

  it('insert commits through the committed factories and adapter', () => {
    const make = () => ({
      factory: vi.fn(() => ({ data: {} })),
      adapter: { applyOps: vi.fn() },
    });
    const a = make();
    const b = make();
    const scene = sceneWith();
    const reg = registryAfterAbandon(a, b, (x) => {
      useInsertDepSource(scene, x.adapter, { rect: x.factory });
    });
    dep(reg, 'insert').commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'rect' });
    expect(a.factory).toHaveBeenCalled();
    expect(a.adapter.applyOps).toHaveBeenCalled();
    expect(b.factory).not.toHaveBeenCalled();
    expect(b.adapter.applyOps).not.toHaveBeenCalled();
  });

  it('resizePolicy reads the committed options', () => {
    const reg = registryAfterAbandon({ label: 'a' }, { label: 'b' }, (o) => { useResizePolicyDepSource(o); });
    expect(dep(reg, 'resizePolicy').label).toBe('a');
  });
});
