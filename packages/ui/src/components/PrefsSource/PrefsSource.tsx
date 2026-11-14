import { createContext, useContext, type ReactNode } from 'react';
import type { LeafReading, PrefGroup, PrefSection } from '@weasel-js/prefs';
import type { LeafState, WriteOptions } from './types';

/**
 * Where a params surface reads and writes its leaves: a form's values map, the selected nodes, a lab's config.
 * Every surface draws its leaves and resets them through one of these, so what a reading, a write, an auto state
 * and a reset mean is answered once.
 */
export interface PrefsSource {
  /** What the source edits, from its root. */
  schema: PrefGroup | PrefSection;
  /** What the surface reads at `path`: a leaf's value as it is shown, and its auto state. */
  valueAt(path: string): LeafReading;
  /** Write `value` at `path` into every target; `AUTO` unpins a leaf that can be auto. */
  write(path: string, value: unknown, options?: WriteOptions): void;
  /** Write into every target what `fn` derives from the value that target holds at `path`, and from the object
   *  it is a field of: what `write` cannot do across targets that differ. */
  update(path: string, fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown, options?: WriteOptions): void;
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

const SourceContext = createContext<PrefsSource | null>(null);

/** Hands `source` to every leaf drawn inside. */
export function PrefsSource({ source, children }: { source: PrefsSource; children?: ReactNode }) {
  return <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
}

/** The source of the params surface this is drawn in. */
export function usePrefsSource(): PrefsSource {
  const source = useContext(SourceContext);
  if (source === null) throw new Error('usePrefsSource: no <PrefsSource> above this component');
  return source;
}
