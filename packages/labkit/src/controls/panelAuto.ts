import { isPrefLeaf } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { useMemo, useRef, useState } from 'react';
import { AUTO, isAuto } from '../config/auto';
import { applyConfigWrite, startAutoPathsOf } from '../config/autoConfig';
import { configLeaves } from '../config/leaves';
import { configValueAt, schemaNodeAt } from '../config/path';
import type { ResolvedConfig } from '../config/types';
import { autoRowValue } from './rowAuto';

type Write = (path: string, value: unknown) => void;
type SetAuto = (fn: (prev: ReadonlySet<string>) => ReadonlySet<string>) => void;

const startSet = (resolved: ResolvedConfig): ReadonlySet<string> =>
  new Set(startAutoPathsOf(resolved));

/** What a panel's own auto set is kept for: the schema's leaf paths, and which of them start auto. */
const schemaShape = (resolved: ResolvedConfig): string =>
  `${Array.from(configLeaves(resolved.group))
    .map(([path]) => path)
    .join('\n')}\n*${startAutoPathsOf(resolved).join('\n')}`;

/** What the auto row at `path` draws. */
function drawnAuto(resolved: ResolvedConfig, shown: unknown, path: string): unknown {
  const node = schemaNodeAt(resolved.group, path);
  return node && isPrefLeaf(node) ? autoRowValue(node, shown, path) : configValueAt(shown, path);
}

/**
 * Which rows are unpinned. An owner that tracks the set decides what a dot means; one that does not gets a
 * panel that decides for itself, because the alternative is handing it a sentinel it would write into the
 * config as though it were a value.
 */
export function usePanelAuto(given: ReadonlySet<string> | undefined, resolved: ResolvedConfig) {
  // A panel keeping its own set opens with the leaves its schema starts auto, as a trial does, and opens
  // afresh on a schema of other leaves. A schema resolved anew each render keeps its pins: the set is keyed
  // by what the schema holds, not by the object.
  const shape = useMemo(() => schemaShape(resolved), [resolved]);
  const [own, setOwn] = useState(() => ({ shape, paths: startSet(resolved) }));
  if (own.shape !== shape) setOwn({ shape, paths: startSet(resolved) });
  const setOwnAuto: SetAuto = (fn) =>
    setOwn((prev) => {
      const paths = fn(prev.paths);
      return paths === prev.paths ? prev : { shape: prev.shape, paths };
    });
  return { given, auto: given ?? own.paths, setOwnAuto };
}

/**
 * The writes a panel's rows make, and what hands a row to its resolver or takes it back. An owner tracking
 * the set hears every edit as a write that pins, and a sentinel in a group's value (a reset) as unpinning that
 * leaf; a panel tracking its own does both here, as `applyConfigWrite` says. A draft pins too, so the row
 * follows the edit, but a draft back to the value the edit began from, as a canceled edit ends, takes the pin
 * back with it.
 */
export function usePanelWrites(
  { given, auto, setOwnAuto }: ReturnType<typeof usePanelAuto>,
  resolved: ResolvedConfig,
  config: Record<string, unknown>,
  shown: Record<string, unknown>,
  writes: { setConfig: Write; draftConfig?: Write },
) {
  const drafted = useRef(new Map<string, { from: unknown; stored: unknown }>());
  const mark = (path: string, next: boolean): void =>
    setOwnAuto((prev) => {
      if (prev.has(path) === next) return prev;
      const now = new Set(prev);
      if (next) now.add(path);
      else now.delete(path);
      return now;
    });
  const pinning =
    (write: Write) =>
    (path: string, value: unknown): void => {
      // Folded into the latest set, not this render's: a reset of several leaves writes each in one event.
      setOwnAuto((prev) => {
        const { autoPaths } = applyConfigWrite(config, [...prev], path, value);
        return autoPaths.length === prev.size && autoPaths.every((p) => prev.has(p))
          ? prev
          : new Set(autoPaths);
      });
      // What a write stores does not depend on the set, only on the sentinels in `value`.
      if (!isAuto(value))
        write(path, configValueAt(applyConfigWrite(config, [], path, value).config, path));
    };
  const settle = pinning(writes.setConfig);
  const setConfig: Write = (path, value) => {
    drafted.current.delete(path);
    settle(path, value);
  };
  const draftConfig = writes.draftConfig && draftPinning(writes.draftConfig);
  function draftPinning(write: Write): Write {
    const pin = pinning(write);
    return (path, value) => {
      const started = drafted.current.get(path);
      if (started && deepEqual(value, started.from)) {
        drafted.current.delete(path);
        mark(path, true);
        write(path, started.stored);
        return;
      }
      if (!started && auto.has(path))
        drafted.current.set(path, {
          from: drawnAuto(resolved, shown, path),
          stored: configValueAt(config, path),
        });
      pin(path, value);
    };
  }
  const setRowAuto = (path: string, next: boolean, value: unknown): void => {
    if (given) {
      writes.setConfig(path, next ? AUTO : value);
      return;
    }
    drafted.current.delete(path);
    mark(path, next);
    // Pinning keeps whatever the row was showing, the same value the controlled
    // path writes back.
    if (!next) writes.setConfig(path, value);
  };
  if (given) return { setRowAuto, setConfig: writes.setConfig, draftConfig: writes.draftConfig };
  return { setRowAuto, setConfig, draftConfig };
}
