import { useMemo, useRef, useState } from 'react';
import { withValueAtPath } from './path';

/** The values an instrument reported for its auto paths, by dotted path. */
export type AutoReports = ReadonlyMap<string, unknown>;

const NONE: AutoReports = new Map();

/** `shown` with each report written over the path it names, for the paths still auto. A report outranks
 *  the path's resolver: it is what the instrument actually used. `null`, like `undefined`, is no report. */
export function withAutoReports<TC>(
  shown: TC,
  reports: AutoReports | undefined,
  auto: ReadonlySet<string>,
): TC {
  if (!reports || reports.size === 0) return shown;
  let out = shown;
  for (const [path, value] of reports) {
    if (auto.has(path) && value != null) out = withValueAtPath(out, path, value);
  }
  return out;
}

interface Report {
  value: unknown;
  /** How many times its path had gone auto when it was made. */
  epoch: number;
}

/** How many times each path has gone auto, advanced by the render that first sees it auto. */
function advance(
  at: { auto: ReadonlySet<string>; of: Map<string, number> },
  auto: ReadonlySet<string>,
) {
  if (at.auto === auto) return;
  for (const path of auto) if (!at.auto.has(path)) at.of.set(path, (at.of.get(path) ?? 0) + 1);
  at.auto = auto;
}

/**
 * A trial's auto reports, held beside the store and never in it. A report reads only while its path is auto
 * in the same stretch it was made in: a report for a pinned path never shows, and pinning a path ends its
 * report, so going auto again shows nothing until the instrument reports afresh. `undefined` or `null`
 * withdraws one.
 *
 * Which stretch a path is in is counted from the renders, not held in state: an instrument reports from an
 * effect of the very commit that turns its path auto, and a copy of the auto set kept in state still read
 * pinned there, so that report was thrown away.
 */
export function useAutoReports(auto: ReadonlySet<string>): {
  reports: AutoReports;
  report: (path: string, value: unknown) => void;
} {
  const epochs = useRef({ auto, of: new Map<string, number>() });
  advance(epochs.current, auto);
  const [held, setHeld] = useState<ReadonlyMap<string, Report>>(new Map());
  const [report] = useState(() => (path: string, value: unknown): void => {
    const epoch = epochs.current.of.get(path) ?? 0;
    setHeld((prev) => {
      const was = prev.get(path);
      if (value === undefined || value === null) {
        if (!was) return prev;
        const next = new Map(prev);
        next.delete(path);
        return next;
      }
      if (was && was.epoch === epoch && Object.is(was.value, value)) return prev;
      return new Map(prev).set(path, { value, epoch });
    });
  });
  const reports = useMemo(() => {
    const out = new Map<string, unknown>();
    for (const [path, r] of held) {
      if (auto.has(path) && r.epoch === (epochs.current.of.get(path) ?? 0)) out.set(path, r.value);
    }
    return out.size === 0 ? NONE : out;
  }, [held, auto]);
  return { reports, report };
}
