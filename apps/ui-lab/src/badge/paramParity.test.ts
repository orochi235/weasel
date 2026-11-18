import { type ConfigShape, f } from '@weasel-js/labkit';
import {
  BADGE_BASES, BADGE_SHAPES, badgeBaseDefaults, badgeShapeDefaults,
} from '@weasel-js/ui/components/Badge';
import { describe, expect, it } from 'vitest';
import { BASE_PARAMS, composedBaseParams } from './compose/composeConfig';
import { badgeParams, type Params } from './params';
import { SHAPE_PARAMS } from './shapeParams';

/** What the lab hands `<Badge>` for `shape` at its defaults. */
const labDefaults = (shape: ConfigShape): Params => badgeParams(shape, f.schema(shape).defaults() as Params);

/** `defaults` less what the lab leaves the badge to choose: a param it leaves unset. */
function drawnDefaults(shape: ConfigShape, defaults: Readonly<Params>): Params {
  const labs = f.schema(shape).defaults() as Params;
  return Object.fromEntries(Object.entries(defaults).filter(([key]) => labs[key] !== null));
}

describe("the lab's param tables", () => {
  it.each(BADGE_SHAPES)('offer every param shape %s takes, at the default it draws with', (shape) => {
    const own = SHAPE_PARAMS[shape];
    expect(own ? labDefaults(own) : {}).toEqual(own ? drawnDefaults(own, badgeShapeDefaults(shape)) : badgeShapeDefaults(shape));
  });

  it.each(BADGE_BASES)('offer every param base %s takes, at the default it draws with', (base) => {
    const params = f.schema(BASE_PARAMS[base]).defaults() as Params;
    expect(composedBaseParams({ base, params: { [base]: params } as never }))
      .toEqual(drawnDefaults(BASE_PARAMS[base], badgeBaseDefaults(base)));
  });

});
