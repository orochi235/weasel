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
      let fresh = false;
      for (const [name, loader] of Object.entries(next)) {
        loaders.set(name, loader);
        if (!states.has(name)) {
          states.set(name, 'idle');
          fresh = true;
        }
      }
      if (fresh) changed();
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
        .then((mod) => addTables(mod.default))
        .then(() => 'loaded' as const, (error: unknown) => {
          if (isDev()) console.error(`icon variant "${name}" failed to load`, error);
          return 'failed' as const;
        })
        .then((settled) => {
          // Out of flight before the notice, so a listener retrying a failure starts a fresh load.
          pending.delete(name);
          set(name, settled);
        });
      pending.set(name, run);
      return run;
    },
  };
}
