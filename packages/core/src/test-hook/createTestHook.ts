import type { TestHookRefs, WeaselTestHook } from './types';

export function createTestHook(refs: TestHookRefs): WeaselTestHook {
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });
  const probes = new Map<string, () => unknown>();

  return {
    ready,
    getScene() {
      const s = refs.getScene();
      if (!s) throw new Error('weasel test hook: scene not mounted yet');
      return s.toJSON();
    },
    getSelection() {
      return [...refs.getSelectionIds()];
    },
    getView() {
      return refs.getView();
    },
    getActiveToolId() {
      return refs.getActiveToolId();
    },
    probe<T = unknown>(name: string): T | undefined {
      const fn = probes.get(name);
      return fn ? (fn() as T) : undefined;
    },
    registerProbe<T>(name: string, fn: () => T) {
      probes.set(name, fn as () => unknown);
      return () => {
        if (probes.get(name) === fn) probes.delete(name);
      };
    },
    _markReady() {
      resolveReady();
    },
  };
}
