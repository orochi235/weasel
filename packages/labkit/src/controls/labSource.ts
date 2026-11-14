import {
  AUTO,
  type LeafReading,
  type PrefGroup,
  type PrefLeaf,
  type PrefSection,
  prefAutoValue,
  prefCanAuto,
  prefLeafAt,
  prefLeafValue,
  prefNodeAt,
  prefResets,
  prefShownValue,
} from '@weasel-js/prefs';
import {
  type LeafState,
  type PrefsSource,
  sourceResetPlan,
} from '@weasel-js/ui/components/PrefsSource';
import { useMemo } from 'react';
import { isRecord, valueAtPath, withValueAtPath } from '../config/path';
import { isEncodedLeaf } from '../config/storedDefault';
import type { ResolvedConfig } from '../config/types';
import { isLeafActive, isLeafEnabled, isLeafVisible } from '../config/visible';
import { leafValueAt } from './fields';

/** What the row at `path` shows of `config` while pinned: an encoded leaf's stored value read through its encoding. */
export function shownAt(config: Record<string, unknown>, path: string, leaf: PrefLeaf): unknown {
  if (!isEncodedLeaf(leaf)) return leafValueAt(config, path, leaf);
  const dot = path.lastIndexOf('.');
  const within = dot === -1 ? config : valueAtPath(config, path.slice(0, dot));
  return prefShownValue(leaf, valueAtPath(config, path), isRecord(within) ? within : undefined);
}

type Write = (path: string, value: unknown) => void;

/** What a lab's config source reads and writes. */
export interface LabConfigInput {
  resolved: ResolvedConfig;
  config: Record<string, unknown>;
  /** `config` with every auto path resolved: what an unpinned leaf shows. */
  shown: Record<string, unknown>;
  /** Writes one value, the `auto` sentinel included. */
  setConfig: Write;
  /** Where the values an edit passes through go. Absent, a draft is written as `setConfig` writes. */
  draftConfig?: Write;
  /** The paths now unpinned. */
  auto?: ReadonlySet<string>;
  /** Unpins a leaf or pins it at `value`. Without it no leaf is auto here. */
  setRowAuto?: (path: string, next: boolean, value: unknown) => void;
  /** The schema the panel's aliases point into, which its conditions may read. */
  over?: PrefGroup | PrefSection;
}

/** A source over a lab's config. A reset of several leaves under one path is one write of that path's value, so
 *  it is one undo step. */
export function labConfigSource(input: LabConfigInput): PrefsSource {
  const { resolved, config, shown, setConfig, draftConfig, auto, setRowAuto, over } = input;
  const leafOf = (path: string): PrefLeaf | undefined => prefLeafAt(resolved.group, path);
  const autoAt = (path: string): boolean | undefined => {
    const leaf = leafOf(path);
    if (!leaf || setRowAuto === undefined || !prefCanAuto(leaf)) return undefined;
    return auto?.has(path) ?? false;
  };
  const valueAt = (path: string): LeafReading => {
    const leaf = leafOf(path);
    const unpinned = autoAt(path);
    const at = unpinned === undefined ? {} : { auto: unpinned };
    if (!leaf) {
      const value = valueAtPath(config, path);
      return { value, mixed: false, each: [value], ...at };
    }
    const value = unpinned
      ? prefLeafValue(leaf, prefAutoValue(leaf, valueAtPath(shown, path)))
      : shownAt(config, path, leaf);
    return { value, mixed: false, each: [value], ...at };
  };
  const write = (path: string, value: unknown, options?: { draft?: boolean }): void =>
    (options?.draft === true && draftConfig ? draftConfig : setConfig)(path, value);
  const source: PrefsSource = {
    schema: resolved.group,
    valueAt,
    write,
    update: (path, fn, options) => {
      const dot = path.lastIndexOf('.');
      const within = dot === -1 ? config : valueAtPath(config, path.slice(0, dot));
      write(path, fn(valueAtPath(config, path), isRecord(within) ? within : undefined), options);
    },
    autoAt,
    setAuto: (path, next) => {
      if (autoAt(path) !== undefined) setRowAuto?.(path, next, valueAt(path).value);
    },
    stateAt: (path): LeafState => ({
      disabled: !isLeafEnabled(resolved, path, config, over),
      hidden: !isLeafVisible(resolved, path, config, true, over),
      active: isLeafActive(resolved, path, config, over),
    }),
    reset: (paths) => {
      const plan = sourceResetPlan(source, paths);
      for (const path of paths) {
        if (path === '') {
          for (const w of plan) setConfig(w.path, w.write);
          continue;
        }
        const under = plan.filter((w) => w.path === path || w.path.startsWith(`${path}.`));
        if (under.length === 0) continue;
        const planned = new Set(under.map((w) => w.path));
        const node = prefNodeAt(resolved.group, path);
        // A group's value is written whole, and the write pins every leaf in it holding no sentinel: one the reset
        // leaves unpinned keeps it.
        const kept = (node ? prefResets(node, path) : []).filter(
          (r) => !planned.has(r.path) && autoAt(r.path) === true,
        );
        const next = [...under, ...kept.map((r) => ({ path: r.path, write: AUTO }))].reduce(
          (at, w) => withValueAtPath(at, w.path, w.write),
          config,
        );
        setConfig(path, valueAtPath(next, path));
      }
    },
  };
  return source;
}

/** {@link labConfigSource}, rebuilt only when what it reads changes. */
export function useLabConfigSource(input: LabConfigInput): PrefsSource {
  const { resolved, config, shown, setConfig, draftConfig, auto, setRowAuto, over } = input;
  return useMemo(
    () =>
      labConfigSource({ resolved, config, shown, setConfig, draftConfig, auto, setRowAuto, over }),
    [resolved, config, shown, setConfig, draftConfig, auto, setRowAuto, over],
  );
}
