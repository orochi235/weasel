import { cssColorLiteral } from '@weasel-js/paint';
import type { BadgeBase, BadgeEffect, BadgeEffectSpec } from '@weasel-js/ui/components/Badge';
import { defaultsOf } from '../shapeControls';
import { BASE_LAB_CONTROLS, EFFECT_LAB_CONTROLS, isColorParam } from './controls';
import type { LabPreset } from './presets';
import type { LabEffect, LabParams, LabSnapshot } from './snapshot';

type Shape = Pick<LabSnapshot, 'base' | 'baseParams' | 'labEffects' | 'nextId'>;
type Padding = Pick<LabSnapshot, 'padTop' | 'padRight' | 'padBottom' | 'padLeft' | 'linkPadX' | 'linkPadY'>;

export type PadSide = 'top' | 'right' | 'bottom' | 'left';

/** One side's padding set, carrying the opposite side with it while that axis is linked. */
export function padPatch(pad: Pick<Padding, 'linkPadX' | 'linkPadY'>, side: PadSide, value: number): Partial<Padding> {
  switch (side) {
    case 'top': return pad.linkPadY ? { padTop: value, padBottom: value } : { padTop: value };
    case 'bottom': return pad.linkPadY ? { padBottom: value, padTop: value } : { padBottom: value };
    case 'left': return pad.linkPadX ? { padLeft: value, padRight: value } : { padLeft: value };
    case 'right': return pad.linkPadX ? { padRight: value, padLeft: value } : { padRight: value };
  }
}

/** An axis linked or unlinked. Linking copies the leading side (left, top) onto its opposite. */
export function linkPatch(pad: Pick<Padding, 'padTop' | 'padLeft'>, axis: 'x' | 'y', on: boolean): Partial<Padding> {
  if (axis === 'x') return on ? { linkPadX: true, padRight: pad.padLeft } : { linkPadX: false };
  return on ? { linkPadY: true, padBottom: pad.padTop } : { linkPadY: false };
}

export function basePatch(base: BadgeBase): Pick<Shape, 'base' | 'baseParams'> {
  return { base, baseParams: defaultsOf(BASE_LAB_CONTROLS[base]) };
}

/** The shape a fresh lab starts from. Ids keep counting, so a later effect never reuses one. */
export function resetPatch(): Pick<Shape, 'base' | 'baseParams' | 'labEffects'> {
  return { ...basePatch('rounded-rect'), labEffects: [] };
}

export function presetPatch(preset: LabPreset, nextId: number): Shape {
  const labEffects = preset.effects.map((e, i) => ({
    id: nextId + i,
    type: e.type,
    params: { ...defaultsOf(EFFECT_LAB_CONTROLS[e.type]), ...e.params },
  }));
  return {
    base: preset.base,
    // A polygon preset carries its vertices as an array, which no lab control edits.
    baseParams: { ...defaultsOf(BASE_LAB_CONTROLS[preset.base]), ...preset.baseParams } as LabParams,
    labEffects,
    nextId: nextId + labEffects.length,
  };
}

export function addEffect(shape: Pick<Shape, 'labEffects' | 'nextId'>, type: BadgeEffect): Pick<Shape, 'labEffects' | 'nextId'> {
  const effect: LabEffect = { id: shape.nextId, type, params: defaultsOf(EFFECT_LAB_CONTROLS[type]) };
  return { labEffects: [...shape.labEffects, effect], nextId: shape.nextId + 1 };
}

export function removeEffect(effects: readonly LabEffect[], id: number): LabEffect[] {
  return effects.filter((e) => e.id !== id);
}

export function setEffectParam(effects: readonly LabEffect[], id: number, key: string, value: number | string): LabEffect[] {
  return effects.map((e) => (e.id === id ? { ...e, params: { ...e.params, [key]: value } } : e));
}

/** Effect `id` switched to another type, at that type's default params. */
export function setEffectType(effects: readonly LabEffect[], id: number, type: BadgeEffect): LabEffect[] {
  return effects.map((e) => (e.id === id ? { ...e, type, params: defaultsOf(EFFECT_LAB_CONTROLS[type]) } : e));
}

/**
 * Effect `id` dropped into the gap `gap`, counted against the list as it stands
 * before the move: gap 0 is above the first card, gap `length` below the last.
 */
export function moveEffectToGap(effects: readonly LabEffect[], id: number, gap: number): LabEffect[] {
  const from = effects.findIndex((e) => e.id === id);
  const target = from < gap ? gap - 1 : gap;
  if (from < 0 || from === target) return [...effects];
  const next = [...effects];
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(target, next.length)), 0, moved);
  return next;
}

/** The lab's effect list as `<Badge effects>` takes it: a color control's hex string becomes a color literal. */
export function effectSpecs(effects: readonly LabEffect[]): BadgeEffectSpec[] {
  return effects.map((e) => ({
    type: e.type,
    params: Object.fromEntries(
      Object.entries(e.params).map(([k, v]) => [k, isColorParam(e.type, k) ? cssColorLiteral(String(v)) : v]),
    ) as never,
  }));
}
