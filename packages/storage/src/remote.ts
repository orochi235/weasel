import { deepEqual } from '@weasel-js/registry';
import type { RecordChange } from './records';
import type { StorageChange } from './types';

/** What taking another writer's changes reads from the cache it takes them into. */
export interface RemoteOptions {
  prefix: string;
  /** The cache's records by name, which taken changes write. */
  values: Map<string, unknown>;
  /** Whether a write of ours to `name` is queued or on its way. */
  owns(name: string): boolean;
  /** Whether a write of ours to `name` is queued, not yet sent. */
  queued(name: string): boolean;
  /** Whether the cache still takes changes: not closed or stopped. */
  live(): boolean;
  /** Storage's record under `key`. */
  read(key: string): Promise<unknown>;
  applied(changes: RecordChange[]): void;
  overruled(changes: [string, unknown][]): void;
}

/** Another writer's changes, taken into a cache: `apply` takes a batch, and `settled` says the last write of ours to
 *  a record on its way has landed or failed. */
export interface Remote {
  apply(changes: StorageChange[]): void;
  settled(name: string): void;
}

export function createRemote(o: RemoteOptions): Remote {
  // Names another writer changed while only a write of ours was on its way. Which landed last is unknown until
  // ours has, so storage is read then: a substrate may report a write before it resolves to its writer.
  const contested = new Set<string>();
  // How many changes from another writer each name has taken, so a read started before one does not undo it.
  const taken = new Map<string, number>();

  const apply = (changes: StorageChange[]): void => {
    const applied: RecordChange[] = [];
    const overruled: [string, unknown][] = [];
    for (const [key, value] of changes) {
      if (!key.startsWith(o.prefix)) continue;
      const name = key.slice(o.prefix.length);
      if (o.owns(name)) {
        overruled.push([name, value]);
        if (!o.queued(name)) contested.add(name);
        continue;
      }
      if (value === undefined) {
        if (!o.values.has(name)) continue;
        o.values.delete(name);
      } else {
        o.values.set(name, value);
      }
      taken.set(name, (taken.get(name) ?? 0) + 1);
      applied.push({ name, value, origin: 'remote' });
    }
    if (overruled.length > 0) o.overruled(overruled);
    if (applied.length > 0) o.applied(applied);
  };

  async function reconcile(name: string): Promise<void> {
    const mark = taken.get(name);
    let value: unknown;
    try {
      value = await o.read(o.prefix + name);
    } catch {
      return;
    }
    if (!o.live() || o.owns(name) || taken.get(name) !== mark) return;
    const held = o.values.has(name);
    if (value === undefined ? !held : held && deepEqual(o.values.get(name), value)) return;
    apply([[o.prefix + name, value]]);
  }

  return {
    apply,
    settled(name) {
      if (!contested.has(name) || o.owns(name)) return;
      contested.delete(name);
      void reconcile(name);
    },
  };
}
