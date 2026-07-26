import { describe, it, expectTypeOf, expect } from 'vitest';
import type {
  Invoker,
  ImmediateInvoker,
  OngoingInvoker,
  OngoingHandle,
  InvocationCtx,
  BindingOpts,
  ActionDeps,
} from './invoker';

describe('Invoker', () => {
  it('ImmediateInvoker has timing "immediate" and run', () => {
    const inv: ImmediateInvoker = {
      timing: 'immediate',
      run: (_deps) => {},
    };
    expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
  });

  it('OngoingInvoker has timing "ongoing" and start returning OngoingHandle', () => {
    const inv: OngoingInvoker = {
      timing: 'ongoing',
      start: (_ctx, _opts) => ({
        onMove: (_ctx) => {},
        onEnd: (_ctx, _reason) => {},
      }),
    };
    expectTypeOf(inv).toMatchTypeOf<OngoingInvoker>();
  });

  it('OngoingHandle fields are all optional', () => {
    const empty: OngoingHandle = {};
    const partial: OngoingHandle = { onMove: () => {} };
    const full: OngoingHandle = { onMove: () => {}, onEnd: () => {} };
    expectTypeOf(empty).toMatchTypeOf<OngoingHandle>();
    expectTypeOf(partial).toMatchTypeOf<OngoingHandle>();
    expectTypeOf(full).toMatchTypeOf<OngoingHandle>();
  });

  it('Invoker is the discriminated union', () => {
    const inv: Invoker = {
      timing: 'immediate',
      run: () => {},
    };
    expectTypeOf(inv).toMatchTypeOf<Invoker>();
  });

  it('discriminator narrows correctly', () => {
    const dispatch = (inv: Invoker, deps: ActionDeps) => {
      if (inv.timing === 'immediate') {
        expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
        inv.run(deps);
      } else {
        expectTypeOf(inv).toMatchTypeOf<OngoingInvoker>();
      }
    };
    expect(dispatch).toBeDefined();
  });

  it('InvocationCtx has the documented fields', () => {
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    expectTypeOf(ctx).toMatchTypeOf<InvocationCtx>();
  });

  it('BindingOpts has optional behaviors', () => {
    const empty: BindingOpts = {};
    const withBehaviors: BindingOpts = { behaviors: [] };
    expectTypeOf(empty).toMatchTypeOf<BindingOpts>();
    expectTypeOf(withBehaviors).toMatchTypeOf<BindingOpts>();
  });
});

describe('BindingOpts.params', () => {
  it('BindingOpts accepts a params bag for action-defined parameters', () => {
    const opts: BindingOpts = {
      behaviors: [],
      params: { magnitude: 'big', axis: 'x' },
    };
    expectTypeOf(opts).toMatchTypeOf<BindingOpts>();
  });

  it('params field is optional', () => {
    const opts: BindingOpts = {};
    expectTypeOf(opts).toMatchTypeOf<BindingOpts>();
  });

  it('ImmediateInvoker.run accepts an optional second params arg', () => {
    const inv: ImmediateInvoker = {
      timing: 'immediate',
      run: (_deps, _params) => {},
    };
    expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
  });

  it('ImmediateInvoker.run still works without params arg (back-compat)', () => {
    const inv: ImmediateInvoker = {
      timing: 'immediate',
      run: (_deps) => {},
    };
    expectTypeOf(inv).toMatchTypeOf<ImmediateInvoker>();
  });
});
