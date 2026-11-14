import { f } from '@weasel-js/labkit';
import {
  type BadgeEffect, type BadgeEffectSpec, type BadgeEffectZone,
} from '@weasel-js/ui/components/Badge';
import type { EffectKind } from '@weasel-js/ui/components/EffectList';
import { EFFECT_PARAMS } from './effectParams';
import { badgeParams, type Params } from './params';

/** One card of the effect stack. */
export interface LabEffect {
  id: number;
  type: BadgeEffect;
  name: string;
  /** Off, the badge skips it. */
  on: boolean;
  params: Params;
}

/** A card's kind is its effect's zone; colors index the theme's tint list. */
export const EFFECT_KINDS: Record<BadgeEffectZone, EffectKind> = {
  offset: { label: 'Offset', color: 3 },
  foreground: { label: 'Foreground', color: 2 },
  background: { label: 'Background', color: 9 },
  mask: { label: 'Mask', color: 8 },
};

/** An effect type as a name: `bevel2` reads "Bevel 2". */
export const effectLabel = (type: BadgeEffect): string =>
  type.replace(/^./, (c) => c.toUpperCase()).replace(/(\D)(\d+)$/, '$1 $2');

export const effectDefaults = (type: BadgeEffect): Params => f.schema(EFFECT_PARAMS[type]).defaults() as Params;

/** The id the next card takes: past every id in the list. */
export const nextEffectId = (effects: readonly LabEffect[]): number => effects.reduce((next, e) => Math.max(next, e.id + 1), 1);

export function freshEffect(id: number, type: BadgeEffect, params: Params = {}): LabEffect {
  return { id, type, name: effectLabel(type), on: true, params: { ...effectDefaults(type), ...params } };
}

export const addEffect = (effects: readonly LabEffect[], type: BadgeEffect): LabEffect[] =>
  [...effects, freshEffect(nextEffectId(effects), type)];

export function setEffectParam(effects: readonly LabEffect[], id: number, key: string, value: unknown): LabEffect[] {
  return effects.map((e) => (e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e));
}

/** Effect `id` switched to another type, at that type's defaults. A name still the old type's default follows the type. */
export function setEffectType(effects: readonly LabEffect[], id: number, type: BadgeEffect): LabEffect[] {
  return effects.map((e) => (e.id === id
    ? { ...e, type, name: e.name === effectLabel(e.type) ? effectLabel(type) : e.name, params: effectDefaults(type) }
    : e));
}

/** The effects that are on, as `<Badge effects>` takes them. */
export const effectSpecs = (effects: readonly LabEffect[]): BadgeEffectSpec[] =>
  effects.filter((e) => e.on).map((e) => ({ type: e.type, params: badgeParams(EFFECT_PARAMS[e.type], e.params) as never }));
