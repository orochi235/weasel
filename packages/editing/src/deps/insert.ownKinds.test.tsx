/** The insert dep reads a kind's factory from the canvas's own factories only: a kind named for an
 *  `Object.prototype` member has none, and builds nothing. */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DepRegistryProvider, useDepRegistry, type DepRegistry } from '@weasel-js/routing/react';
import type { Scene } from '@weasel-js/core';
import { useInsertDepSource } from './insert';

describe('the insert dep and a kind named constructor', () => {
  it('finds no factory for it and inserts nothing', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const applyOps = vi.fn();
    const scene = {
      layers: [{ id: 'default' }], renderOrder: () => [], get: () => undefined, mintId: () => 'n', roots: [],
    } as unknown as Scene<unknown, string, unknown>;
    let reg!: DepRegistry;
    function Wire() {
      useInsertDepSource(scene, { applyOps }, {});
      reg = useDepRegistry();
      return null;
    }
    render(<DepRegistryProvider><Wire /></DepRegistryProvider>);
    const insert = (reg.get as (k: string) => { commit(b: unknown, e: unknown): unknown })('insert');
    expect(insert.commit({ x: 0, y: 0, width: 10, height: 10 }, { kind: 'constructor' })).toBeNull();
    expect(applyOps).not.toHaveBeenCalled();
  });
});
