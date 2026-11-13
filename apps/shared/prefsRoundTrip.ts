import { prefLeaves, type PrefEnum, type PrefGroup, type PrefLeaf, type PrefNumber, type PrefsStore } from '@weasel-js/prefs';
import { createMemoryAdapter, type SyncStorageAdapter } from '@weasel-js/storage';

/** A value `leaf` holds that is not its default, for the kinds the apps' prefs use. Throws on any other kind, so a
 *  leaf of a new kind fails the round trip until it has one. */
export function otherPrefValue(leaf: PrefLeaf): unknown {
  switch (leaf.kind) {
    case 'boolean':
      return !leaf.default;
    case 'enum':
      return (leaf as PrefEnum).options.find((o) => o.value !== leaf.default)!.value;
    case 'number': {
      const { min, max, default: d } = leaf as PrefNumber & { default: number };
      return max !== undefined && max !== d ? max : min !== undefined && min !== d ? min : d + 1;
    }
    case 'string':
    case 'registry-enum':
      return `${String(leaf.default)}-other`;
    case 'color':
      return leaf.default === '#123456' ? '#654321' : '#123456';
    case 'paint':
      return { kind: 'solid', color: '#123456ff' };
    case 'data':
      return Array.isArray(leaf.default) ? [{ probe: true }] : { probe: { hidden: true } };
    default:
      throw new Error(`no other value for a ${leaf.kind} pref`);
  }
}

/**
 * Sets every leaf of `schema` to a value not its default in a store `open` makes, waits for it to reach storage,
 * and reads each back from a second store opened over the same records. Returns what was set and what was read,
 * by path, for a test to compare.
 */
export async function prefsRoundTrip<S extends PrefGroup>(
  schema: S,
  open: (storage: SyncStorageAdapter) => PrefsStore<S>,
): Promise<{ sent: Record<string, unknown>; read: Record<string, unknown> }> {
  const backing = new Map<string, unknown>();
  const store = open(createMemoryAdapter(backing));
  const sent: Record<string, unknown> = {};
  for (const [path, leaf] of prefLeaves(schema)) {
    sent[path] = otherPrefValue(leaf);
    store.set(path as never, sent[path] as never);
  }
  if (!(await store.flush())) throw new Error('the prefs did not reach storage');
  await store.close();
  const again = open(createMemoryAdapter(backing));
  const read = Object.fromEntries(Object.keys(sent).map((path) => [path, again.get(path as never)]));
  await again.close();
  return { sent, read };
}
