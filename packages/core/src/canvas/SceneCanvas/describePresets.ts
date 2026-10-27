import { namesBuiltins, presetToolIds, type FeaturePreset } from './features';

/** One preset as data: what it holds by id, for a tool that lists or rearranges presets. */
export interface PresetDescription {
  id: string;
  label: string;
  /** The package that ships it, as `describePresets` was told. */
  package: string;
  /** It has a role beyond actions, built-in tools, and includes, so its parts only work together. */
  atom: boolean;
  /** Its own action ids, in registration order. */
  actions: readonly string[];
  /** Its own tools' ids: built-ins with their sets opened, then tools of its own. */
  tools: readonly string[];
  /** The ids of the presets it includes. */
  includes: readonly string[];
}

const ATOM_ROLES = [
  'ambient', 'moveBehaviors', 'snapSources', 'layers', 'chrome', 'chromeRules', 'pathEdit', 'contributions', 'refines',
] as const satisfies readonly (keyof FeaturePreset)[];

const filled = (v: unknown): boolean =>
  v !== undefined && (typeof v !== 'object' || v === null || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0));

/** Whether `preset` is an atom: it holds a role beyond actions, built-in tools, and includes. */
export function isAtom(preset: FeaturePreset): boolean {
  return ATOM_ROLES.some((role) => filled(preset[role])) || (preset.tools ?? []).some((t) => !namesBuiltins(t));
}

/**
 * Every preset reachable from `sources` (keyed by the package that ships them), its includes followed, once each,
 * each after the presets it includes. A preset reached from two packages is the first's.
 */
export function describePresets(sources: Readonly<Record<string, readonly FeaturePreset[]>>): PresetDescription[] {
  const out: PresetDescription[] = [];
  const seen = new Set<string>();
  const visit = (p: FeaturePreset, pkg: string): void => {
    if (seen.has(p.id)) return;
    seen.add(p.id);
    for (const inner of p.includes ?? []) visit(inner, pkg);
    out.push({
      id: p.id,
      label: p.label ?? p.id,
      package: pkg,
      atom: isAtom(p),
      actions: (p.actions ?? []).map((a) => a.id),
      tools: presetToolIds(p),
      includes: (p.includes ?? []).map((inner) => inner.id),
    });
  };
  for (const [pkg, presets] of Object.entries(sources)) for (const p of presets) visit(p, pkg);
  return out;
}
