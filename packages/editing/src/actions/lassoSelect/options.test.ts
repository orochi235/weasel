import { describe, it, expectTypeOf } from 'vitest';
import type { LassoHitMode } from '@weasel-js/core/engine';
import type { UseLassoSelectOptions } from './options';

describe('UseLassoSelectOptions', () => {
  it('carries the hit mode the action reads from its params', () => {
    const opts: UseLassoSelectOptions = { mode: 'enclosed', minVertexSpacing: 0 };
    expectTypeOf(opts.mode).toEqualTypeOf<LassoHitMode | undefined>();
  });
});
