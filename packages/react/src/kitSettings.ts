import { createEmitter } from '@weasel-js/registry';
import type { KitSettings } from './index';

/** A value a settings leaf can hold. */
export type KitSettingLeaf = number | string | boolean;

/** `T` with every area and leaf optional: what a provider sets. */
export type KitSettingsOverrides<T = KitSettings> = {
  [K in keyof T]?: T[K] extends KitSettingLeaf ? T[K] : KitSettingsOverrides<T[K]>;
};

/** The dotted path of every leaf in `T`: `'tree.typeaheadMs'`. */
export type KitSettingPath<T = KitSettings> = {
  [K in keyof T & string]: T[K] extends KitSettingLeaf ? K : `${K}.${KitSettingPath<T[K]>}`;
}[keyof T & string];

/** The type of the leaf at `P` in `T`. */
export type KitSettingAt<P extends string, T = KitSettings> = P extends `${infer H}.${infer R}`
  ? H extends keyof T ? KitSettingAt<R, T[H]> : never
  : P extends keyof T ? T[P] : never;

/** Reads settings by path and says when any of them changed. */
export interface KitSettingsStore<T = KitSettings> {
  /** The value at `path`: this store's own, else the nearest ancestor's, else `undefined`. */
  get<P extends KitSettingPath<T>>(path: P): KitSettingAt<P, T> | undefined;
  subscribe(listener: () => void): () => void;
}

/** A store whose own overrides can be replaced. */
export interface WritableKitSettingsStore<T = KitSettings> extends KitSettingsStore<T> {
  /** Replace this store's own overrides, notifying only when some leaf's value changed. */
  set(overrides: KitSettingsOverrides<T>): void;
}

function leafAt(tree: unknown, path: string): unknown {
  let at = tree;
  for (const key of path.split('.')) {
    if (at === null || typeof at !== 'object' || !Object.hasOwn(at, key)) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function flatten(tree: unknown, prefix: string, out: Map<string, unknown>): Map<string, unknown> {
  if (tree === null || typeof tree !== 'object') return out;
  for (const [key, value] of Object.entries(tree)) {
    if (value === undefined) continue;
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (value !== null && typeof value === 'object') flatten(value, path, out);
    else out.set(path, value);
  }
  return out;
}

const sameLeaves = (a: Map<string, unknown>, b: Map<string, unknown>): boolean =>
  a.size === b.size && [...a].every(([path, value]) => b.has(path) && Object.is(b.get(path), value));

/**
 * A settings store holding `overrides`, reading through to `parent` for any
 * leaf it does not set. A change in the parent notifies this store's
 * listeners too.
 */
export function createKitSettingsStore<T = KitSettings>(
  overrides: KitSettingsOverrides<T> = {},
  parent: KitSettingsStore<T> | null = null,
): WritableKitSettingsStore<T> {
  let own: unknown = overrides;
  let leaves = flatten(own, '', new Map());
  const listeners = createEmitter();
  const notify = (): void => listeners.emit();
  let unhookParent: (() => void) | null = null;

  return {
    get(path) {
      const value = leafAt(own, path);
      return (value !== undefined ? value : parent?.get(path)) as never;
    },
    subscribe(listener) {
      const off = listeners.subscribe(listener);
      if (parent && unhookParent === null) unhookParent = parent.subscribe(notify);
      return () => {
        off();
        if (listeners.size === 0 && unhookParent) {
          unhookParent();
          unhookParent = null;
        }
      };
    },
    set(next) {
      const nextLeaves = flatten(next, '', new Map());
      own = next;
      if (sameLeaves(leaves, nextLeaves)) return;
      leaves = nextLeaves;
      notify();
    },
  };
}

/** The store read where no provider is mounted: it sets nothing. */
export const NO_KIT_SETTINGS: KitSettingsStore = createKitSettingsStore();
