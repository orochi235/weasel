import { describe, it, expectTypeOf } from 'vitest';
import type { DepSchema } from '@weasel-js/routing';
import type { SelectionApi } from 'core/selection/useSelection';
import type { History } from '@weasel-js/history';
import type { ActiveToolContextValue } from '@weasel-js/routing/react';
import './depSchema';

describe('DepSchema', () => {
  it('declares selection: SelectionApi', () => {
    expectTypeOf<DepSchema['selection']>().toEqualTypeOf<SelectionApi>();
  });

  it('declares view (ViewApi shape with get/set)', () => {
    expectTypeOf<DepSchema['view']>().toMatchTypeOf<{ get(): unknown; set(v: unknown): void }>();
  });

  it('declares scene', () => {
    expectTypeOf<DepSchema['scene']>().not.toBeNever();
  });

  it('declares history: History', () => {
    expectTypeOf<DepSchema['history']>().toEqualTypeOf<History>();
  });

  it('declares activeTool: ActiveToolContextValue', () => {
    expectTypeOf<DepSchema['activeTool']>().toEqualTypeOf<ActiveToolContextValue>();
  });
});
