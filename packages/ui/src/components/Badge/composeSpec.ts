import type { ShapeModule } from './types';
import { BASES, type BadgeBase, type BadgeBaseParams } from './bases';
import type { BaseModule } from './bases/types';
import type { BadgeEffectSpec } from './effects';
import { registryEntry } from './registryEntry';
import { withDefaults } from './shapes/params';
import type { InsetSource } from './useInsets';

/** What a badge is composed from, or a null `base` for one its shape draws itself. */
export interface ComposeSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry's own type: a base's params are known only by its runtime key.
  base: BaseModule<any> | null;
  baseParams: unknown;
  effects: BadgeEffectSpec[] | undefined;
  /** Whether `base` is the `base` prop's, rather than one the shape composes itself from. */
  fromProp: boolean;
}

/**
 * The base and effects a badge draws: the `base` prop's with the `effects` prop, or else, as for a
 * `base` the registry does not hold, the ones its shape composes itself from, which fall back to the `effects` prop.
 */
export function resolveCompose(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as the SHAPES registry types it.
  shape: ShapeModule<any>,
  shapeParams: unknown,
  own: { base?: BadgeBase; baseParams?: BadgeBaseParams[BadgeBase]; effects?: BadgeEffectSpec[] },
): ComposeSpec {
  const ownBase = registryEntry(BASES, own.base);
  const spec = !ownBase && shape.compose ? shape.compose(shapeParams) : null;
  const base = ownBase ?? registryEntry(BASES, spec?.base as BadgeBase | undefined) ?? null;
  const given = ownBase ? own.baseParams : spec?.baseParams;
  return {
    base,
    baseParams: base ? withDefaults<Record<string, unknown>>(base.defaults ?? {}, given as Record<string, unknown> | undefined) : null,
    effects: ownBase ? own.effects : (spec?.effects as BadgeEffectSpec[] | undefined) ?? own.effects,
    fromProp: ownBase !== undefined,
  };
}

/**
 * What pads a badge: a shape's own insets, fitted against its base's outline when it composes
 * itself from one, or a `base` prop's base's.
 */
export function insetSource(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as the SHAPES registry types it.
  shape: ShapeModule<any>,
  shapeParams: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as `ComposeSpec.base`.
  base: BaseModule<any> | null,
  baseFromProp: boolean,
): InsetSource<unknown> {
  if (!base) return shape;
  if (baseFromProp) return base;
  const insets = typeof shape.insets === 'function' ? shape.insets(shapeParams) : shape.insets;
  return { insets, fitsContent: base.fitsContent, build: base.build };
}
