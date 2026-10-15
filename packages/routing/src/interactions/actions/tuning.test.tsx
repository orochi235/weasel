import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { actionBindings } from './binding';
import { resolveParams, type BindingOpts, type InvocationCtx } from './invoker';
import type { Action } from './action';
import { tuneAction } from './tuning';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';

const ctx = {} as InvocationCtx;

function immediate(run = vi.fn()): Action {
  return {
    id: 'flip', label: 'Flip',
    defaultBinding: [{ spec: { kind: 'key', key: 'h' }, opts: { params: { axis: 'x' } } }],
    invoker: { timing: 'immediate', run },
  };
}

describe('tuneAction', () => {
  it("fills params in beneath what the invocation passes", () => {
    const run = vi.fn();
    const tuned = tuneAction(immediate(run), [{ params: { axis: 'y', pivot: 'pointer' } }]);
    if (tuned.invoker?.timing !== 'immediate') throw new Error('timing');
    tuned.invoker.run({}, { axis: 'x' });
    tuned.invoker.run({});
    expect(run.mock.calls.map((c) => c[1])).toEqual([
      { axis: 'x', pivot: 'pointer' },
      { axis: 'y', pivot: 'pointer' },
    ]);
  });

  it('reads a params thunk at each call, so a change between calls applies', () => {
    const run = vi.fn();
    let radius = 4;
    const tuned = tuneAction(immediate(run), [{ params: () => ({ radiusPx: radius }) }]);
    if (tuned.invoker?.timing !== 'immediate') throw new Error('timing');
    tuned.invoker.run({});
    radius = 9;
    tuned.invoker.run({});
    expect(run.mock.calls.map((c) => c[1].radiusPx)).toEqual([4, 9]);
  });

  it("hands an ongoing action a thunk that stays live through the gesture", () => {
    let seen: BindingOpts | undefined;
    const ongoing: Action = {
      id: 'extend', label: 'Extend',
      invoker: { timing: 'ongoing', start: (_c, opts) => { seen = opts; return {}; } },
    };
    let mode = 'tangent';
    const tuned = tuneAction(ongoing, [{ params: () => ({ mode }) }]);
    if (tuned.invoker?.timing !== 'ongoing') throw new Error('timing');
    tuned.invoker.start(ctx, { params: { side: 'end' } });
    expect(resolveParams(seen?.params)).toEqual({ mode: 'tangent', side: 'end' });
    mode = 'curvature';
    expect(resolveParams(seen?.params)).toEqual({ mode: 'curvature', side: 'end' });
  });

  it('keeps a record a record when nothing involved is a thunk', () => {
    let seen: BindingOpts | undefined;
    const ongoing: Action = {
      id: 'paint', label: 'Paint',
      invoker: { timing: 'ongoing', start: (_c, opts) => { seen = opts; return {}; } },
    };
    const tuned = tuneAction(ongoing, [{ params: { a: 1 } }]);
    if (tuned.invoker?.timing !== 'ongoing') throw new Error('timing');
    tuned.invoker.start(ctx, { params: { b: 2 } });
    expect(seen?.params).toEqual({ a: 1, b: 2 });
  });

  it('adds bindings after the built-in ones, once however often it is applied', () => {
    const k = { spec: { kind: 'key' as const, key: 'k' }, opts: { params: { axis: 'y' } } };
    const tuning = { bindings: [k] };
    const once = tuneAction(immediate(), [tuning]);
    const twice = tuneAction(once, [tuning]);
    expect(actionBindings(twice).map((b) => [b.spec, b.opts?.params])).toEqual([
      [{ kind: 'key', key: 'h' }, { axis: 'x' }],
      [{ kind: 'key', key: 'k' }, { axis: 'y' }],
    ]);
  });

  it('gives an action with no bindings of its own the ones it adds', () => {
    const bare: Action = { id: 'cycle', label: 'Cycle', invoker: { timing: 'immediate', run: vi.fn() } };
    const tuned = tuneAction(bare, [{ bindings: [{ kind: 'key', key: 'k' }] }]);
    expect(actionBindings(tuned).map((b) => b.spec)).toEqual([{ kind: 'key', key: 'k' }]);
  });

  it('returns a copy it already tuned unchanged', () => {
    const tuning = { params: { a: 1 } };
    const once = tuneAction(immediate(), [tuning]);
    expect(tuneAction(once, [tuning])).toBe(once);
  });
});

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

describe('ActionsRegistry.tune', () => {
  it('applies to the action in list() and trigger(), and its release undoes it', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const run = vi.fn();
    let release!: () => void;
    act(() => {
      reg.register(immediate(run));
      release = reg.tune('flip', { params: { pivot: 'union' }, bindings: [{ kind: 'key', key: 'k' }] });
    });
    expect(actionBindings(reg.list()[0]!)).toHaveLength(2);
    reg.trigger('flip', { axis: 'y' });
    expect(run).toHaveBeenLastCalledWith(expect.anything(), { axis: 'y', pivot: 'union' });

    act(() => { release(); });
    expect(actionBindings(reg.list()[0]!)).toHaveLength(1);
    reg.trigger('flip', { axis: 'y' });
    expect(run).toHaveBeenLastCalledWith(expect.anything(), { axis: 'y' });
  });

  it('applies to an action registered after the tuning, and over a replacement', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const first = vi.fn();
    const second = vi.fn();
    act(() => {
      reg.tune('flip', { params: { pivot: 'union' } });
      reg.register(immediate(first));
    });
    reg.trigger('flip');
    act(() => { reg.register(immediate(second)); });
    reg.trigger('flip');
    expect(first).toHaveBeenCalledWith(expect.anything(), { pivot: 'union' });
    expect(second).toHaveBeenCalledWith(expect.anything(), { pivot: 'union' });
  });

  it('notifies subscribers when a tuning comes and goes', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const listener = vi.fn();
    reg.subscribe(listener);
    let release!: () => void;
    act(() => { release = reg.tune('flip', { params: {} }); });
    act(() => { release(); release(); });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
