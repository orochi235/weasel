import { createReflectable, type Reflection } from '@weasel-js/registry';
import { IMPLICIT_TAGS } from './capabilities';
import type { ModeDefinition } from './modeDefinition';

/** Options for `createModeRegistry`: the modes to register and which one is
 *  active at startup. */
export interface CreateModeRegistryOptions {
  modes: readonly ModeDefinition[];
  initial: string;
}

/** Holds the set of available modes and which one is active, and notifies
 *  subscribers when that changes. `getVersion` is a monotonic counter for
 *  render-cache invalidation. Unknown mode ids throw rather than being
 *  ignored. */
export interface ModeRegistry {
  current(): ModeDefinition;
  /** Every registered mode, in registration order. */
  list(): readonly ModeDefinition[];
  setMode(id: string): void;
  byId(id: string): ModeDefinition;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
  /** The registered modes keyed by id. Shares this registry's version, so it
   *  also advances on `setMode`. */
  readonly reflection: Reflection<ModeDefinition>;
}

/** Build a mode registry. Throws if `initial` does not name one of `modes`. */
export function createModeRegistry(opts: CreateModeRegistryOptions): ModeRegistry {
  const modes = createReflectable<ModeDefinition>();
  for (const m of opts.modes) modes.set(m.id, m);
  const initial = modes.get(opts.initial);
  if (!initial) throw new Error(`Initial mode "${opts.initial}" not in modes list`);

  let active: ModeDefinition = initial;

  return {
    current: () => active,
    list: () => opts.modes,
    setMode(id: string): void {
      const next = modes.get(id);
      if (!next) throw new Error(`Unknown mode id: ${id}`);
      if (next === active) return;
      active = next;
      modes.bump();
    },
    byId(id: string): ModeDefinition {
      const m = modes.get(id);
      if (!m) throw new Error(`Unknown mode id: ${id}`);
      return m;
    },
    getVersion: modes.getVersion,
    subscribe: modes.subscribe,
    reflection: modes.reflection,
  };
}

/** The active mode as a canvas gates on it: its id, and every capability tag
 *  a tool may carry to be usable in it — the mode's `allows` plus
 *  `IMPLICIT_TAGS`. The shape `<SceneCanvas getActiveMode>` reads. */
export interface ActiveMode {
  id: string;
  allowedCapabilities: ReadonlySet<string>;
}

/** A mode definition as a canvas gates on it. */
export function activeModeOf(mode: ModeDefinition): ActiveMode {
  return { id: mode.id, allowedCapabilities: new Set<string>([...mode.allows, ...IMPLICIT_TAGS]) };
}

/** A reader for the registry's active mode, suitable as
 *  `<SceneCanvas getActiveMode>`. It returns the same object until the mode
 *  changes. */
export function getActiveModeFor(registry: ModeRegistry): () => ActiveMode {
  let cached: { version: number; value: ActiveMode } | null = null;
  return () => {
    const version = registry.getVersion();
    if (cached?.version !== version) cached = { version, value: activeModeOf(registry.current()) };
    return cached.value;
  };
}
