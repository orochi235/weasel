import type { PresetDescription } from '@weasel-js/prefs-schema';
import { namesBuiltins, presetToolIds, type FeaturePreset } from './features';

export type { PresetDescription };

/**
 * What each key of a preset is: its name, a grouping role a bundle may hold, or a role that makes it an atom. A
 * record over every key, so a role added to `FeaturePreset` fails to compile until it is classed here.
 */
const ROLE_KINDS: Record<keyof FeaturePreset, 'name' | 'bundle' | 'atom'> = {
  id: 'name', label: 'name',
  actions: 'bundle', tools: 'bundle', includes: 'bundle',
  toolActions: 'atom', ambient: 'atom', moveBehaviors: 'atom', snapSources: 'atom', layers: 'atom', chrome: 'atom',
  chromeRules: 'atom', pathEdit: 'atom', routing: 'atom', insertNodeFactories: 'atom', insertKinds: 'atom',
  shapes: 'atom', properties: 'atom', contributions: 'atom', components: 'atom', contentHandlers: 'atom',
  build: 'atom', selection: 'atom', selectionChrome: 'atom', refines: 'atom',
};
const ATOM_ROLES = (Object.keys(ROLE_KINDS) as (keyof FeaturePreset)[]).filter((k) => ROLE_KINDS[k] === 'atom');

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
