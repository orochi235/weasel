import {
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
  prefAutoValue,
  prefCanAuto,
  prefValueOrDefault,
  sourceLeafIsAtReset,
} from '@weasel-js/prefs';
import { useMemo } from 'react';
import { autoQuotes, autoResolverOf, resolveAutoConfig } from '../config/autoConfig';
import { configValueAt } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { leafValueAt } from './fields';
import { autoReadout, summarizeAuto } from './inDialog';
import { createLabConfigSource } from './labSource';

/** What a row reads its auto state from. */
export interface RowAutoSource {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: Record<string, unknown>;
  /** `config` with every auto path resolved. */
  shown: Record<string, unknown>;
  auto: ReadonlySet<string> | undefined;
  setRowAuto: ((path: string, next: boolean, value: unknown) => void) | undefined;
  /** Writes one value, the `AUTO` sentinel included: what a reset goes through. */
  setConfig: (path: string, value: unknown) => void;
  /** The schema the panel's aliases point into, where an alias row's leaf and its reset live. */
  over?: PrefGroup | PrefSection;
}

/** What a row would read as auto, pinned or not; `cycles` where unpinning it would close a resolver cycle. */
function useUnpinned(
  { shown, resolved, config, auto, path }: RowAutoSource,
  resolves: boolean,
  isAutoRow: boolean,
): { value?: unknown; cycles?: true } {
  return useMemo(() => {
    if (!resolves) return {};
    if (isAutoRow) return { value: configValueAt(shown, path) };
    try {
      return {
        value: configValueAt(
          resolveAutoConfig(resolved, config, new Set([...(auto ?? []), path])),
          path,
        ),
      };
    } catch {
      // Unpinning this path would close a resolver cycle: the row has no auto
      // value to quote, and going auto would throw out of the panel's render.
      return { cycles: true };
    }
  }, [resolves, isAutoRow, shown, resolved, config, auto, path]);
}

/**
 * A row's auto state: whether it is auto, the value it draws, and the props its
 * row takes to show and toggle it, and to reset it while it is not what a reset makes it.
 */
export function useRowAuto(source: RowAutoSource) {
  const { path, leaf, config, shown, auto, setRowAuto } = source;
  const pinned = leafValueAt(config, path, leaf);
  const isAutoRow = auto?.has(path) ?? false;
  const canAuto = setRowAuto !== undefined && prefCanAuto(leaf);
  // Read out of the resolved config rather than re-running this leaf's own
  // resolver, so the row reports the value the instrument actually got — the
  // two diverge as soon as a resolver reads another auto path.
  const resolvedValue = isAutoRow ? configValueAt(shown, path) : undefined;
  // An auto row's control stays live, so it draws the value in effect (`prefAutoValue`: the report or the
  // resolver's, else `auto.value`), never the stale pinned value underneath. Pinning keeps it. With none yet,
  // the control has to draw something, and draws what a field holding nothing draws.
  const value = isAutoRow ? prefValueOrDefault(leaf, prefAutoValue(leaf, resolvedValue)) : pinned;
  const setAuto = (next: boolean): void => setRowAuto?.(path, next, value);
  // What the row would read as auto, pinned or not: the config resolved with
  // this path unpinned beside the ones that already are. Only where something
  // computes it: a leaf the instrument works out has nothing to quote until it reports.
  const computes = autoResolverOf(leaf) !== undefined || leaf.auto?.value !== undefined;
  const unpinned = useUnpinned(
    source,
    canAuto && (computes || resolvedValue !== undefined),
    isAutoRow,
  );
  const onAutoChange = canAuto && !unpinned.cycles ? setAuto : undefined;
  const autoValue = unpinned.value === undefined ? undefined : summarizeAuto(unpinned.value, leaf);
  return {
    isAutoRow,
    value,
    setAuto,
    // The word marks the row auto beside its live control; a leaf that quotes its value adds it.
    readout: isAutoRow ? autoReadout(autoQuotes(leaf) ? autoValue : undefined) : undefined,
    props: { auto: isAutoRow, onAutoChange, autoValue, onReset: rowReset(source) },
  };
}

/** The row's reset, where its leaf is not already as a reset leaves it (`readingIsAtReset`). */
function rowReset({
  path,
  leaf,
  resolved,
  config,
  shown,
  auto,
  setRowAuto,
  setConfig,
  over,
}: RowAutoSource): (() => void) | undefined {
  const source = createLabConfigSource({
    resolved,
    config,
    shown,
    setConfig,
    auto,
    setRowAuto,
    over,
  });
  return sourceLeafIsAtReset(source, path, leaf) ? undefined : () => source.reset([path]);
}
