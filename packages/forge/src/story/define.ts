import type { MetaSpec, StorySpec } from './types';

export const NATIVE = Symbol.for('weaselforge.native');

/** Declares a native story file's meta; default-export the result. */
export function meta(spec: MetaSpec): MetaSpec {
  return Object.assign({}, spec, { [NATIVE]: 'meta' as const });
}

/** Declares one native story; export the result under the story's name. `C` and `S` come from `config` and `state`. */
export function story<C = Record<string, never>, S = undefined>(spec: StorySpec<C, S>): StorySpec<C, S> {
  return Object.assign({}, spec, { [NATIVE]: 'story' as const });
}

export function isNative(value: unknown, kind: 'meta' | 'story'): boolean {
  return !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[NATIVE] === kind;
}
