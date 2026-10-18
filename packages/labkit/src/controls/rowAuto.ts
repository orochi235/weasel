import { type PrefLeaf, type PrefNumber, resolvePrefUnit } from '@weasel-js/prefs';
import { useMemo } from 'react';
import { autoResolverOf, leafCanAuto, resolveAutoConfig } from '../config/autoConfig';
import { valueAtPath } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { summarizeLeaf, summarizeValue } from './inDialog';

/** An auto value as tooltip text. A number with a unit reads as its field shows it. Any other computed
 *  number is cut to 6 significant digits, so `0.1 + 0.2` reads `0.3`. */
function summarizeAuto(value: unknown, leaf: PrefLeaf): string {
  if (typeof value !== 'number') return summarizeLeaf(leaf, value);
  const unit = leaf.kind === 'number' ? (leaf as PrefNumber).unit : undefined;
  return unit === undefined
    ? summarizeValue(Number(value.toPrecision(6)))
    : resolvePrefUnit(unit).format(value);
}

/** What a row reads its auto state from. */
export interface RowAutoSource {
  path: string;
  leaf: PrefLeaf;
  resolved: ResolvedConfig;
  config: Record<string, unknown>;
  /** `config` with every auto path resolved. */
  shown: Record<string, unknown>;
  /** The value the row holds while pinned. */
  pinned: unknown;
  auto: ReadonlySet<string> | undefined;
  setRowAuto: ((path: string, next: boolean, value: unknown) => void) | undefined;
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
 * row takes to show and toggle it.
 */
export function useRowAuto(source: RowAutoSource) {
  const { path, leaf, shown, pinned, auto, setRowAuto } = source;
  const isAutoRow = auto?.has(path) ?? false;
  const canAuto = setRowAuto !== undefined && leafCanAuto(leaf);
  // Read out of the resolved config rather than re-running this leaf's own
  // resolver, so the row reports the value the instrument actually got — the
  // two diverge as soon as a resolver reads another auto path.
  const resolvedValue = isAutoRow ? valueAtPath(shown, path) : undefined;
  // An auto row draws what the resolver decided, not the value underneath it —
  // a handle sitting at the pinned number while the readout says something else
  // reads as a rendering bug. Pinning then keeps what you were looking at.
  const value = resolvedValue ?? pinned;
  const setAuto = (next: boolean): void => setRowAuto?.(path, next, value);
  // What the row would read as auto, pinned or not: the config resolved with
  // this path unpinned beside the ones that already are.
  const resolves = canAuto && autoResolverOf(leaf) !== undefined;
  const unpinned = useUnpinned(source, resolves, isAutoRow);
  const onAutoChange = canAuto && !unpinned.cycles ? setAuto : undefined;
  const autoValue = unpinned.value === undefined ? undefined : summarizeAuto(unpinned.value, leaf);
  return {
    isAutoRow,
    value,
    setAuto,
    // An auto row hides its control, so the word is all the row has to say.
    readout: isAutoRow ? 'auto' : undefined,
    props: { auto: isAutoRow, onAutoChange, autoValue },
  };
}
