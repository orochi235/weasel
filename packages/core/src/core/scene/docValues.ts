/**
 * Document state that is not a node — a document's pages, its theme — held as
 * named JSON values beside the tree, saved in its snapshot and undone with it.
 */
import { deepEqual } from '@weasel-js/registry';
import type { RegisteredOp } from './types';

/**
 * A scene's document values. Keys are namespaced by their owner
 * (`core:pages`, `diagram:theme`); values are JSON, and are not to be mutated
 * once set. A `set` is a scene edit: undoable, part of an enclosing `batch`,
 * skipped when the value is deep-equal to the current one, and heard by
 * `subscribe`. Setting `undefined` removes the key.
 */
export interface SceneDoc {
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  keys(): readonly string[];
}

/** The part of `Scene` that carries its document values. */
export interface SceneDocValues {
  readonly doc: SceneDoc;
}

/** A snapshot's document values. */
export type SerializedDoc = Readonly<Record<string, unknown>>;

/** `undefined` on either side means the key is absent there. */
interface SetDocPayload { key: string; from?: unknown; to?: unknown }

const SET_DOC = 'kit:setDoc';

function write(values: Map<string, unknown>, key: string, to: unknown): void {
  if (to === undefined) values.delete(key);
  else values.set(key, to);
}

/** The snapshot side of a scene's document values, kept in `values`. */
export function createDocStore(values: Map<string, unknown>) {
  return {
    /** The values as a snapshot holds them, or `undefined` when there are none. */
    toJSON(): SerializedDoc | undefined {
      return values.size === 0 ? undefined : Object.fromEntries(values);
    },
    /** Replace every value, outside history. */
    reset(next: SerializedDoc | undefined): void {
      values.clear();
      for (const [key, value] of Object.entries(next ?? {})) write(values, key, value);
    },
  };
}

export interface SceneDocEnv {
  values: Map<string, unknown>;
  register(kind: string, handler: RegisteredOp<unknown>): void;
  record(kind: string, payload: unknown, label: string): void;
}

/** Register `kit:setDoc` and answer with the `SceneDoc` that records it. */
export function createSceneDoc(env: SceneDocEnv): SceneDoc {
  const { values } = env;
  env.register(SET_DOC, {
    apply: (p) => { const { key, to } = p as SetDocPayload; write(values, key, to); },
    revert: (p) => { const { key, from } = p as SetDocPayload; write(values, key, from); },
  });
  return {
    get: <T>(key: string) => values.get(key) as T | undefined,
    set(key, to) {
      const from = values.get(key);
      if (deepEqual(from, to)) return;
      env.record(SET_DOC, { key, from, to } satisfies SetDocPayload, 'setDoc');
    },
    keys: () => [...values.keys()],
  };
}
