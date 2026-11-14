import { deepEqual } from '@weasel-js/registry';
import type { LeafReading } from '../autoReset';
import type { PrefGroup, PrefSection } from '../groups';

/** What the conditions over a path leave it: an `enableIf` that fails, a `showIf` that fails, an `activeIf` that holds. */
export interface LeafState {
  disabled: boolean;
  hidden: boolean;
  active: boolean;
}

/** A path no condition reaches: enabled, shown, and not pressed. */
export const LEAF_FREE: LeafState = { disabled: false, hidden: false, active: false };

/** How a write lands. `draft` is a value an edit passes through on its way to the one it settles on, as a
 *  slider's drag does: written, and kept out of undo, where the surface has a place for drafts. */
export interface SourceWriteOptions {
  draft?: boolean;
}

/**
 * Where a params surface reads and writes its leaves: a form's values map, the selected nodes, a lab's config.
 * Every surface draws its leaves and resets them through one of these, so what a reading, a write, an auto state
 * and a reset mean is answered once. Nothing in it needs React, so a DOM host draws through the same one.
 */
export interface PrefsSource {
  /** What the source edits, from its root. */
  schema: PrefGroup | PrefSection;
  /** What the surface reads at `path`: a leaf's value as it is shown, and its auto state. */
  valueAt(path: string): LeafReading;
  /** Write `value` at `path` into every target; `AUTO` unpins a leaf that can be auto. */
  write(path: string, value: unknown, options?: SourceWriteOptions): void;
  /** Write into every target what `fn` derives from the value that target holds at `path`, and from the object
   *  it is a field of: what `write` cannot do across targets that differ. */
  update(path: string, fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown, options?: SourceWriteOptions): void;
  /** Whether the leaf at `path` is unpinned now; `undefined` where it cannot be auto here. */
  autoAt(path: string): boolean | undefined;
  /** Unpin the leaf at `path` or pin it at the value it shows, where `autoAt` answers for it. Absent on a source
   *  that keeps no auto state. */
  setAuto?(path: string, next: boolean): void;
  /** What the conditions over `path` leave it. */
  stateAt(path: string): LeafState;
  /** Put each leaf or group at `paths` back as its schema starts it, as one step (`resetPlanAt`). */
  reset(paths: readonly string[]): void;
}

/** The reading of several targets' values, in target order: the one they share, or mixed. A target holding
 *  nothing and one holding `undefined` agree. */
export function sharedReading(each: readonly unknown[]): LeafReading {
  const [first, ...rest] = each;
  return rest.every((v) => deepEqual(v, first, { undefinedAsAbsent: true }))
    ? { value: first, mixed: false, each }
    : { value: undefined, mixed: true, each };
}
