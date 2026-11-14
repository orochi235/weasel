import {
  leafAtReset,
  type PrefLeaf,
  type PrefNumber,
  prefAutoValue,
  prefCanAuto,
  prefLeafValue,
} from '@weasel-js/prefs';
import { PropertyAutoReadout } from '@weasel-js/ui/components/Properties';
import { createElement, type ReactNode, useMemo } from 'react';
import { autoQuotes, autoResolverOf, resolveAutoConfig } from '../config/autoConfig';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { leafValueAt } from './fields';
import { numberText, summarizeLeaf, summarizeValue } from './inDialog';
import { createLabConfigSource } from './labSource';

/** An auto value as tooltip text. A number with a unit or a display reads as its field shows it. Any other computed
 *  number is cut to 6 significant digits, so `0.1 + 0.2` reads `0.3`. */
function summarizeAuto(value: unknown, leaf: PrefLeaf): string {
  if (typeof value !== 'number') return summarizeLeaf(leaf, value);
  const text = leaf.kind === 'number' ? numberText(leaf as PrefNumber, value) : undefined;
  return text ?? summarizeValue(Number(value.toPrecision(6)));
}

const autoReadout = (value: string | undefined): ReactNode =>
  value === undefined ? 'auto' : createElement(PropertyAutoReadout, { value });

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
  /** Writes one value, the `auto` sentinel included: what a reset goes through. */
  setConfig: (path: string, value: unknown) => void;
}

/** What a row would read as auto, pinned or not; `cycles` where unpinning it would close a resolver cycle. */
function useUnpinned(
  { shown, resolved, config, auto, path }: RowAutoSource,
  resolves: boolean,
  isAutoRow: boolean,
): { value?: unknown; cycles?: true } {
  return useMemo(() => {
    if (!resolves) return {};
    if (isAutoRow) return { value: valueAtPath(shown, path) };
    try {
      return {
        value: valueAtPath(
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
  const resolvedValue = isAutoRow ? valueAtPath(shown, path) : undefined;
  // An auto row's control stays live, so it draws the value in effect (`prefAutoValue`: the report or the
  // resolver's, else `auto.value`), never the stale pinned value underneath. Pinning keeps it. With none yet,
  // the control has to draw something, and draws what a field holding nothing draws.
  const value = isAutoRow ? prefLeafValue(leaf, prefAutoValue(leaf, resolvedValue)) : pinned;
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

/** The row's reset, where its leaf is not already as a reset leaves it (`leafIsAtReset`). */
function rowReset({
  path,
  leaf,
  resolved,
  config,
  shown,
  auto,
  setRowAuto,
  setConfig,
}: RowAutoSource): (() => void) | undefined {
  const source = createLabConfigSource({ resolved, config, shown, setConfig, auto, setRowAuto });
  return leafAtReset(source, path, leaf) ? undefined : () => source.reset([path]);
}
