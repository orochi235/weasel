/**
 * A live path effect in an SVG file. The effect exports as a group of the
 * paths it shows, so any reader sees what draw shows; on that group the
 * `wd:` namespace carries what keeps it live — `effect`, the node's
 * `data.pathEffect` as JSON, and `depends-on`, its sources' `leaf-id`s as a
 * JSON list. Every exported leaf carries its scene id as `wd:leaf-id` for
 * `depends-on` to name.
 */
import type { PathEffect } from '@weasel-js/core';
import type { Obj } from './svgObj';

/** A path effect in transit: the effect, its sources' ids, and the paths it
 *  shows. */
export interface EffectObj {
  id: string;
  effect: PathEffect;
  dependsOn: readonly string[];
  parts: readonly Obj[];
}

/** What a group's `wd:` attributes say of the effect it is. */
export interface EffectAttrs {
  effect: PathEffect;
  dependsOn: string[];
}

const EFFECT_KINDS: ReadonlySet<string> = new Set<PathEffect['kind']>(['blend', 'bendAlong', 'repeatAlong', 'textAlong']);

/** The `wd:` attributes of an effect's group. */
export function encodeEffectAttrs(o: EffectObj): Record<string, string> {
  return { 'leaf-id': o.id, effect: JSON.stringify(o.effect), 'depends-on': JSON.stringify(o.dependsOn) };
}

/** The effect a group's `wd:` attributes name, or `null` where they name
 *  none or cannot be read — the group then opens as the paths it holds. */
export function decodeEffectAttrs(attrs: Readonly<Record<string, string>> | undefined): EffectAttrs | null {
  if (attrs?.effect === undefined || attrs['depends-on'] === undefined) return null;
  try {
    const effect: unknown = JSON.parse(attrs.effect);
    const dependsOn: unknown = JSON.parse(attrs['depends-on']);
    if (
      typeof effect !== 'object' || effect === null || !EFFECT_KINDS.has((effect as { kind?: string }).kind ?? '')
      || !Array.isArray(dependsOn) || !dependsOn.every((d) => typeof d === 'string')
    ) return null;
    return { effect: effect as PathEffect, dependsOn: dependsOn as string[] };
  } catch {
    return null;
  }
}
