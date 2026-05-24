import type { ModeDefinition } from './modeDefinition';

export interface CreateModeRegistryOptions {
  modes: readonly ModeDefinition[];
  initial: string;
}

export interface ModeRegistry {
  current(): ModeDefinition;
  setMode(id: string): void;
  byId(id: string): ModeDefinition;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

export function createModeRegistry(opts: CreateModeRegistryOptions): ModeRegistry {
  const byIdMap = new Map(opts.modes.map((m) => [m.id, m]));
  const initial = byIdMap.get(opts.initial);
  if (!initial) throw new Error(`Initial mode "${opts.initial}" not in modes list`);

  let active: ModeDefinition = initial;
  let version = 0;
  const listeners = new Set<() => void>();

  function bump(): void {
    version++;
    for (const l of listeners) l();
  }

  return {
    current: () => active,
    setMode(id: string): void {
      const next = byIdMap.get(id);
      if (!next) throw new Error(`Unknown mode id: ${id}`);
      if (next === active) return;
      active = next;
      bump();
    },
    byId(id: string): ModeDefinition {
      const m = byIdMap.get(id);
      if (!m) throw new Error(`Unknown mode id: ${id}`);
      return m;
    },
    getVersion: () => version,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
