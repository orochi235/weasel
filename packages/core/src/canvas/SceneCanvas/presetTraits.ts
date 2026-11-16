/**
 * The node-kind traits the enabled presets bring, merged with the consumer's
 * own under one rule each: presets claim names through an extension registry
 * (the same value again is one entry, a different one throws), and a name the
 * consumer's prop gives keeps the consumer's.
 */
import { useEffect } from 'react';
import { useStableByContent } from '@weasel-js/react';
import { createExtensionRegistry, ExtensionConflictError, sameList } from '@weasel-js/registry';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { InsertNodeFactories, InsertNodeFactory } from '../deps/insertFactories';
import { nodeShapesOf, type NodeShapeEntry } from '../NodeShape';
import type { EnabledPresets, FeaturePreset, PresetNodeShape } from './features';
import { inferredNodeRouting } from './defaultNodeRouting';

/** Every preset's `pick` entries by name, in preset order, each name once. Throws when two presets
 *  give one name values `same` does not call the same. */
export function claimPresetNames<V>(
  presets: readonly FeaturePreset[],
  what: string,
  pick: (p: FeaturePreset) => readonly (readonly [string, V])[],
  same?: (a: V, b: V) => boolean,
): [string, V][] {
  const claims = createExtensionRegistry<V>({ kind: what, ...(same ? { same } : {}) });
  for (const p of presets) {
    for (const [name, value] of pick(p)) {
      try {
        claims.register(name, value, { source: p.id });
      } catch (err) {
        if (!(err instanceof ExtensionConflictError)) throw err;
        const owner = claims.entries().find((e) => e.key === name)?.source;
        throw new Error(`[SceneCanvas] presets "${owner}" and "${p.id}" both give ${what} "${name}" with different values`);
      }
    }
  }
  return claims.entries().map((e) => [e.key, e.value]);
}

/**
 * Named entries the presets give, merged ahead of `base`. With `consumer` given it is the
 * base and keeps every name it lists; unset, `fallback` is, and a preset's entry replaces
 * the default of its name.
 */
export function mergeNamedEntries<E extends { readonly name: string }>(
  presets: readonly FeaturePreset[],
  what: string,
  pick: (p: FeaturePreset) => readonly E[] | undefined,
  consumer: readonly E[] | undefined,
  fallback: readonly E[],
  same?: (a: E, b: E) => boolean,
): readonly E[] {
  const own = claimPresetNames(presets, what, (p) => (pick(p) ?? []).map((e) => [e.name, e] as const), same)
    .map(([, e]) => e);
  if (own.length === 0) return consumer ?? fallback;
  if (consumer) {
    const kept = new Set(consumer.map((e) => e.name));
    return [...own.filter((e) => !kept.has(e.name)), ...consumer];
  }
  const replaced = new Set(own.map((e) => e.name));
  return [...own, ...fallback.filter((e) => !replaced.has(e.name))];
}

/** Two routing entries of one name classify alike when they share a predicate. */
const sameRouting = (a: NodeRoutingEntry, b: NodeRoutingEntry): boolean => a.matches === b.matches;

/** The routing a canvas classifies with: the presets' entries, then its `routing` prop or
 *  `inferredNodeRouting`. */
export function presetRouting(
  presets: readonly FeaturePreset[],
  routing: readonly NodeRoutingEntry[] | undefined,
): readonly NodeRoutingEntry[] {
  return mergeNamedEntries(presets, 'routing entry', (p) => p.routing, routing, inferredNodeRouting, sameRouting);
}

/** The insert factories a canvas builds with: the presets', then its `insertNodeFactories` prop
 *  by kind. */
export function presetInsertFactories(
  presets: readonly FeaturePreset[],
  consumer: InsertNodeFactories | undefined,
): InsertNodeFactories | undefined {
  const own = claimPresetNames(presets, 'insert factory', (p) =>
    Object.entries(p.insertNodeFactories ?? {}).filter((e): e is [string, InsertNodeFactory] => e[1] !== undefined));
  if (own.length === 0) return consumer;
  const out: Record<string, InsertNodeFactory> = Object.fromEntries(own);
  for (const [kind, factory] of Object.entries(consumer ?? {})) if (factory) out[kind] = factory;
  return out;
}

const asInstall = (s: NodeShapeEntry<never, never> | PresetNodeShape): PresetNodeShape =>
  'painter' in s ? s : { painter: s };

/** The shape painters the presets install, in preset order, each painter once. */
export function presetShapes(presets: readonly FeaturePreset[]): PresetNodeShape[] {
  const seen = new Set<object>();
  const out: PresetNodeShape[] = [];
  for (const p of presets) {
    for (const s of p.shapes ?? []) {
      const install = asInstall(s);
      if (seen.has(install.painter)) continue;
      seen.add(install.painter);
      out.push(install);
    }
  }
  return out;
}

/** Register the enabled presets' painters in `scene`'s own registry while the canvas runs them, so
 *  another scene does not paint with them. Each canvas holds its own registrations, so another
 *  canvas of the same scene installing the same painter keeps it when this one lets go. */
export function usePresetShapes(enabled: EnabledPresets, scene: object): void {
  const shapes = useStableByContent(presetShapes(enabled.presets), (a, b) =>
    sameList(a, b, (x, y) => x.painter === y.painter && x.priority === y.priority));
  useEffect(() => {
    const registry = nodeShapesOf(scene);
    const releases = shapes.map((s) => registry.register(s.painter, s.priority ? { priority: s.priority } : {}));
    return () => { for (const r of releases) r(); };
  }, [shapes, scene]);
}

/** Whether an `insert` of `kind` builds a node on a canvas with these factories and presets. */
export function insertBuilds(kind: string, factories: InsertNodeFactories | undefined, kinds: ReadonlySet<string>): boolean {
  return factories?.[kind] !== undefined || kinds.has(kind);
}
