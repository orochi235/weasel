import type { MetaSpec, StorySpec } from './types';

export const NATIVE = Symbol.for('weaselforge.native');

export function meta(spec: MetaSpec): MetaSpec {
  return Object.assign({}, spec, { [NATIVE]: 'meta' as const });
}

/** Unexported, so an exported story's declaration inlines plain config values instead of naming labkit's builder shape, whose classes cannot be emitted. */
type Plain<T> = { [K in keyof T]: T[K] } & {};

export function story<C = Record<string, never>, S = undefined>(spec: StorySpec<C, S>): StorySpec<Plain<C>, S> {
  return Object.assign({}, spec, { [NATIVE]: 'story' as const }) as unknown as StorySpec<Plain<C>, S>;
}

export function isNative(value: unknown, kind: 'meta' | 'story'): boolean {
  return !!value && typeof value === 'object' && (value as Record<symbol, unknown>)[NATIVE] === kind;
}
