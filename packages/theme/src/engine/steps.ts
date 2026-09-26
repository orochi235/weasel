import { isByAxis } from '../axes.ts';

const stepList = (x: unknown): string[] => (Array.isArray(x) ? [...new Set(x.filter((s): s is string => typeof s === 'string'))] : []);

/** The names in every branch of `v`, reading each leaf with `read`, in first-branch order. */
function inEveryBranch(v: unknown, read: (leaf: unknown) => string[]): string[] {
  if (!isByAxis(v)) return read(v);
  const lists = Object.entries(v).filter(([k]) => k !== 'by').map(([, x]) => inEveryBranch(x, read));
  return lists.length === 0 ? [] : lists.reduce((kept, list) => kept.filter((s) => list.includes(s)));
}

/** Step names a ramp or scale entry declares at every selection: those in every `by` branch of the entry and of its `steps`. */
export function alwaysDeclaredSteps(entry: unknown): string[] {
  return inEveryBranch(entry, (e) => (typeof e === 'object' && e !== null ? inEveryBranch((e as { steps?: unknown }).steps, stepList) : []));
}

/** Every step name a ramp or scale entry declares, across every `by` branch of the entry and of its `steps`, first seen first. */
export function declaredSteps(entry: unknown): string[] {
  const out = new Set<string>();
  const branches = (v: unknown, visit: (x: unknown) => void): void => {
    if (!isByAxis(v)) {
      visit(v);
      return;
    }
    for (const [k, x] of Object.entries(v)) if (k !== 'by') branches(x, visit);
  };
  branches(entry, (e) => {
    if (typeof e !== 'object' || e === null) return;
    branches((e as { steps?: unknown }).steps, (steps) => {
      if (Array.isArray(steps)) for (const s of steps) if (typeof s === 'string') out.add(s);
    });
  });
  return [...out];
}
