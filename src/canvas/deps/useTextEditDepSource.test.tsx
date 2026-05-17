import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepRegistry,
  type DepRegistry,
} from 'interactions/actions/depRegistry';
import { useTextEditDepSource } from './useTextEditDepSource';
import type { Scene, NodeId } from 'core/scene/types';

function makeScene(text: boolean): Scene<unknown, string, unknown> {
  const node = { id: 'n', kind: 'leaf' as const, pose: {}, data: { kind: text ? 'text' : 'rect' } };
  return {
    layers: [{ id: 'default' }],
    renderOrder: () => ['n'] as NodeId[],
    get: () => node as never,
  } as unknown as Scene<unknown, string, unknown>;
}

function Capture({ onR }: { onR: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onR(r);
  return null;
}

describe('useTextEditDepSource', () => {
  it('registers a `textEdit` dep with stub startEdit and convention-based isTextNode', () => {
    let reg!: DepRegistry;
    function Wire() {
      useTextEditDepSource(makeScene(true));
      return null;
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('textEdit');
    expect(dep).toBeDefined();
    expect(dep.isTextNode('n')).toBe(true);
    dep.startEdit('n');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('isTextNode returns false for non-text nodes', () => {
    let reg!: DepRegistry;
    function Wire() {
      useTextEditDepSource(makeScene(false));
      return null;
    }
    render(
      <DepRegistryProvider>
        <Wire />
        <Capture onR={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    const dep = (reg.get as any)('textEdit');
    expect(dep.isTextNode('n')).toBe(false);
  });
});
