import { describe, it, expect, vi } from 'vitest';
import { createTestHook } from './createTestHook';
import type { TestHookRefs } from './types';

function refs(overrides: Partial<TestHookRefs> = {}): TestHookRefs {
  const fakeScene = { toJSON: () => ({ version: 1, systemLayers: [], nodes: [] }) } as never;
  return {
    getScene: () => fakeScene,
    getSelectionIds: () => [],
    getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    getActiveToolId: () => null,
    ...overrides,
  };
}

describe('createTestHook', () => {
  it('ready resolves only after _markReady is called', async () => {
    const hook = createTestHook(refs());
    let resolved = false;
    void hook.ready.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    hook._markReady();
    await hook.ready;
    expect(resolved).toBe(true);
  });

  it('getScene returns the serialized snapshot', () => {
    const hook = createTestHook(refs());
    expect(hook.getScene()).toEqual({ version: 1, systemLayers: [], nodes: [] });
  });

  it('getScene throws if scene is not mounted', () => {
    const hook = createTestHook(refs({ getScene: () => null }));
    expect(() => hook.getScene()).toThrow(/scene not mounted/i);
  });

  it('getSelection returns a fresh array each call', () => {
    let ids: string[] = ['a'];
    const hook = createTestHook(refs({ getSelectionIds: () => ids }));
    expect(hook.getSelection()).toEqual(['a']);
    ids = ['a', 'b'];
    expect(hook.getSelection()).toEqual(['a', 'b']);
  });

  it('probe returns undefined for unknown names', () => {
    const hook = createTestHook(refs());
    expect(hook.probe('nope')).toBeUndefined();
  });

  it('registered probes return their fn value; disposer unregisters', () => {
    const hook = createTestHook(refs());
    const fn = vi.fn(() => 42);
    const dispose = hook.registerProbe('answer', fn);
    expect(hook.probe<number>('answer')).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    dispose();
    expect(hook.probe('answer')).toBeUndefined();
  });
});
