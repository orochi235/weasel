import { useState } from 'react';
import { withValueAtPath } from './path';

/** The values an instrument reported for its auto paths, by dotted path. */
export type AutoReports = ReadonlyMap<string, unknown>;

const NONE: AutoReports = new Map();

/** `shown` with each report written over the path it names, for the paths still auto. A report outranks
 *  the path's resolver: it is what the instrument actually used. */
export function withAutoReports<TC>(
  shown: TC,
  reports: AutoReports | undefined,
  auto: ReadonlySet<string>,
): TC {
  if (!reports || reports.size === 0) return shown;
  let out = shown;
  for (const [path, value] of reports) {
    if (auto.has(path)) out = withValueAtPath(out, path, value);
  }
  return out;
}

function pruned(reports: AutoReports, auto: ReadonlySet<string>): AutoReports {
  if ([...reports.keys()].every((p) => auto.has(p))) return reports;
  return new Map([...reports].filter(([p]) => auto.has(p)));
}

interface Held {
  auto: ReadonlySet<string>;
  reports: AutoReports;
}

/**
 * A trial's auto reports, held beside the store and never in it. A report for a path that is not auto
 * is ignored, and a path's report goes as soon as it is pinned, so going auto again shows nothing until
 * the instrument reports afresh.
 */
export function useAutoReports(auto: ReadonlySet<string>): {
  reports: AutoReports;
  report: (path: string, value: unknown) => void;
} {
  const [held, setHeld] = useState<Held>(() => ({ auto, reports: NONE }));
  const [report] = useState(
    () =>
      (path: string, value: unknown): void =>
        setHeld((prev) => {
          if (!prev.auto.has(path)) return prev;
          if (value === undefined) {
            if (!prev.reports.has(path)) return prev;
            const reports = new Map(prev.reports);
            reports.delete(path);
            return { auto: prev.auto, reports };
          }
          if (prev.reports.has(path) && Object.is(prev.reports.get(path), value)) return prev;
          return { auto: prev.auto, reports: new Map(prev.reports).set(path, value) };
        }),
  );
  let current = held;
  if (held.auto !== auto) {
    current = { auto, reports: pruned(held.reports, auto) };
    setHeld(current);
  }
  return { reports: current.reports, report };
}
