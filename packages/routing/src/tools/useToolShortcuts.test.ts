import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ActionsRegistry } from '../interactions/actions/registry';
import { useToolShortcuts } from './useToolShortcuts';

class ClassRegistry {
  private readonly listeners = new Set<() => void>();
  list() { return []; }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
}

describe('useToolShortcuts', () => {
  it('subscribes through a registry whose methods read `this`', () => {
    const registry = new ClassRegistry() as unknown as ActionsRegistry;
    const { result } = renderHook(() => useToolShortcuts(registry, {}));
    expect(result.current).toEqual({});
  });
});
