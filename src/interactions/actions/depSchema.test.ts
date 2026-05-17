import { describe, it, expectTypeOf } from 'vitest';
import type { DepSchema } from './depRegistry';
import type { SelectionApi } from 'core/selection/useSelection';
import type { History } from 'core/history/history';
import type { PointerContextValue } from 'features/pointer/PointerContext';
import type { ActiveToolContextValue } from './activeToolContext';
// Force the side-effect import (augments DepSchema):
import './depSchema';

describe('DepSchema kit-standard augmentation', () => {
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

  it('declares pointer: PointerContextValue', () => {
    expectTypeOf<DepSchema['pointer']>().toEqualTypeOf<PointerContextValue>();
  });

  it('declares activeTool: ActiveToolContextValue', () => {
    expectTypeOf<DepSchema['activeTool']>().toEqualTypeOf<ActiveToolContextValue>();
  });
});
