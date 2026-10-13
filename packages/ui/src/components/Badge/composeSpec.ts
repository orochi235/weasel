import type { ShapeModule } from './types';
import { BASES, type BadgeBase, type BadgeBaseParams } from './bases';
import type { BaseModule } from './bases/types';
import type { BadgeEffectSpec } from './effects';

/** What a badge is composed from, or a null `base` for one its shape draws itself. */
export interface ComposeSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the registry's own type: a base's params are known only by its runtime key.
  base: BaseModule<any> | null;
  baseParams: unknown;
  effects: BadgeEffectSpec[] | undefined;
}

/**
 * The base and effects a badge draws: the `base` prop's with the `effects` prop, or else the
 * ones its shape composes itself from, which fall back to the `effects` prop.
 */
export function resolveCompose(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- as the SHAPES registry types it.
  shape: ShapeModule<any>,
  shapeParams: unknown,
  own: { base?: BadgeBase; baseParams?: BadgeBaseParams[BadgeBase]; effects?: BadgeEffectSpec[] },
): ComposeSpec {
  const spec = !own.base && shape.compose ? shape.compose(shapeParams) : null;
  const key = own.base ?? (spec?.base as BadgeBase | undefined);
  const base = key ? BASES[key] : null;
  const given = own.base ? own.baseParams : spec?.baseParams;
  return {
    base,
    baseParams: base ? { ...(base.defaults ?? {}), ...(given ?? {}) } : null,
    effects: own.base ? own.effects : (spec?.effects as BadgeEffectSpec[] | undefined) ?? own.effects,
  };
}
