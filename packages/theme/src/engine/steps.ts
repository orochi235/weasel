import { isByAxis } from '../axes';

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
