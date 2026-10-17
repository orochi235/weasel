import { isDev } from '@weasel-js/registry';
import type { IconTable, IconVariantLoader } from './table';

/** Where a named icon variant stands: no loader for it (`unknown`), a loader not yet run (`idle`), in flight, in, or failed. */
export type IconVariantState = 'unknown' | 'idle' | 'loading' | 'loaded' | 'failed';

/** Loads each named variant at most once at a time; a failure leaves it retryable. */
export function createVariants(addTables: (tables: readonly IconTable[]) => void, changed: () => void) {
  const loaders = new Map<string, IconVariantLoader>();
  const states = new Map<string, IconVariantState>();
  const pending = new Map<string, Promise<void>>();

  const set = (name: string, state: IconVariantState) => {
    states.set(name, state);
    changed();
  };

  return {
    provide(next: Readonly<Record<string, IconVariantLoader>>): void {
      for (const [name, loader] of Object.entries(next)) {
        loaders.set(name, loader);
        if (!states.has(name)) states.set(name, 'idle');
      }
      changed();
    },
    state(name: string): IconVariantState {
      return states.get(name) ?? 'unknown';
    },
    load(name: string): Promise<void> {
      const loader = loaders.get(name);
      if (!loader || states.get(name) === 'loaded') return Promise.resolve();
      const inFlight = pending.get(name);
      if (inFlight) return inFlight;
      set(name, 'loading');
      const run = Promise.resolve()
        .then(loader)
        .then((mod) => {
          addTables(mod.default);
          set(name, 'loaded');
        })
        .catch((error: unknown) => {
          if (isDev()) console.error(`icon variant "${name}" failed to load`, error);
          set(name, 'failed');
        })
        .finally(() => pending.delete(name));
      pending.set(name, run);
      return run;
    },
  };
}
