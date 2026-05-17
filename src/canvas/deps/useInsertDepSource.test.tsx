import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useInsertDepSource } from './useInsertDepSource';
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
