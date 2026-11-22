import { isDev } from '@weasel-js/registry';
import type { IconTable, IconVariantLoader } from './table';

/** Where a named icon variant stands: no loader for it (`unknown`), a loader not yet run (`idle`), in flight, in, or failed. */
export type IconVariantState = 'unknown' | 'idle' | 'loading' | 'loaded' | 'failed';

/** Loads each named variant at most once at a time; a failure leaves it retryable, and a new loader for it idle. */
export function createVariants(addTables: (tables: readonly IconTable[]) => () => void, changed: () => void) {
  const loaders = new Map<string, IconVariantLoader>();
  const states = new Map<string, IconVariantState>();
  const pending = new Map<string, Promise<void>>();
  const releases = new Map<string, () => void>();

  const drop = (name: string) => {
    loaders.delete(name);
    states.delete(name);
    pending.delete(name);
    const release = releases.get(name);
    releases.delete(name);
    release?.();
  };

  const set = (name: string, state: IconVariantState) => {
    states.set(name, state);
    changed();
  };

  return {
    provide(next: Readonly<Record<string, IconVariantLoader>>, options?: { replace?: boolean }): void {
      let fresh = false;
      if (options?.replace) {
        for (const name of [...states.keys()]) {
          if (Object.hasOwn(next, name)) continue;
          drop(name);
          fresh = true;
        }
      }
      for (const [name, loader] of Object.entries(next)) {
        const replaced = loaders.get(name) !== loader;
        loaders.set(name, loader);
        // A name never seen, or one whose loader failed and has been replaced, is loadable again.
        if (!states.has(name) || (replaced && states.get(name) === 'failed')) {
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
      const current = () => pending.get(name) === run;
      const run: Promise<void> = Promise.resolve()
        .then(loader)
        .then((mod) => {
          if (current()) releases.set(name, addTables(mod.default));
        })
        .then(() => 'loaded' as const, (error: unknown) => {
          if (isDev() && current()) console.error(`icon variant "${name}" failed to load`, error);
          return 'failed' as const;
        })
        .then((settled) => {
          if (!current()) return;
          // Out of flight before the notice, so a listener retrying a failure starts a fresh load.
          pending.delete(name);
          // A loader handed over while this one ran was kept for no run; once this one fails, it is the next to try.
          set(name, settled === 'failed' && loaders.get(name) !== loader ? 'idle' : settled);
        });
      // In flight before the notice, so a listener asking for it again joins this load.
      pending.set(name, run);
      set(name, 'loading');
      return run;
    },
  };
}
