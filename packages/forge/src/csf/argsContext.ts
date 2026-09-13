import { type Context, createContext } from 'react';

export interface ArgsScope {
  args: Record<string, unknown>;
  defaults: Record<string, unknown>;
  setConfig: (path: string, value: unknown) => void;
}

const KEY = Symbol.for('weaselforge.csfArgs');
const registry = globalThis as { [KEY]?: Context<ArgsScope | null> };

// Keyed on globalThis: the aliased shim and the frame's loader can load as two module copies.
export const ArgsContext: Context<ArgsScope | null> = (registry[KEY] ??= createContext<ArgsScope | null>(null));
