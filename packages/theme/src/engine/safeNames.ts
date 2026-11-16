import type { ThemeDefinition } from '../definition.ts';
import { isSafeTokenName, unsafeTokenName } from '../dtcg/types.ts';
import type { Issue } from './types.ts';

const NAMED_LAYERS = ['ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** `def` without the entries whose names cannot name a token, each reported in `issues`. */
export function withoutUnsafeNames(def: ThemeDefinition, issues: Issue[] = []): ThemeDefinition {
  let out = def;
  for (const layer of NAMED_LAYERS) {
    const entries = def[layer];
    if (!entries || Object.keys(entries).every(isSafeTokenName)) continue;
    for (const n of Object.keys(entries)) {
      if (!isSafeTokenName(n)) issues.push({ kind: 'invalid', path: `${layer}.${n}`, message: unsafeTokenName(n) });
    }
    out = { ...out, [layer]: Object.fromEntries(Object.entries(entries).filter(([n]) => isSafeTokenName(n))) };
  }
  return out;
}
