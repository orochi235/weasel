import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installTestHookIfRequested, releaseTestHook } from './install';
import type { TestHookRefs, WeaselTestHook } from './types';

function refs(activeToolId: string): TestHookRefs {
  return {
    getScene: () => null,
    getSelectionIds: () => [],
    getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    getActiveToolId: () => activeToolId,
  };
}

describe('installTestHookIfRequested', () => {
  const held: WeaselTestHook[] = [];
  const install = (id: string) => {
    const hook = installTestHookIfRequested(refs(id));
    if (hook) held.push(hook);
    return hook;
  };

  beforeEach(() => {
    window.history.replaceState({}, '', '?test=1');
  });
  afterEach(() => {
    for (const hook of held.splice(0)) releaseTestHook(hook);
    delete window.__weaselTest;
    window.history.replaceState({}, '', window.location.pathname);
  });

  it('does nothing without ?test=1', () => {
    window.history.replaceState({}, '', window.location.pathname);
    expect(install('a')).toBeNull();
    expect(window.__weaselTest).toBeUndefined();
  });

  it('answers for the first canvas while it is mounted', () => {
    install('a');
    install('b');
    expect(window.__weaselTest?.getActiveToolId()).toBe('a');
  });

  it('passes to the surviving canvas when the owner unmounts', () => {
    const a = install('a')!;
    install('b');
    releaseTestHook(a);
    expect(window.__weaselTest?.getActiveToolId()).toBe('b');
  });

  it('stays with the owner when a later canvas unmounts', () => {
    install('a');
    const b = install('b')!;
    releaseTestHook(b);
    expect(window.__weaselTest?.getActiveToolId()).toBe('a');
  });

  it('removes the global when the last canvas unmounts', () => {
    const a = install('a')!;
    const b = install('b')!;
    releaseTestHook(a);
    releaseTestHook(b);
    expect(window.__weaselTest).toBeUndefined();
  });

  it('leaves a global it did not set alone', () => {
    const foreign = { foreign: true } as unknown as WeaselTestHook;
    window.__weaselTest = foreign;
    expect(install('a')).toBeNull();
    expect(window.__weaselTest).toBe(foreign);
  });
});
