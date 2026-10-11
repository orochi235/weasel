import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLassoTool } from './useLassoTool';
import { resolveParams } from '@weasel-js/routing';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import type { Tool } from '../../overlayBinding';

describe('useLassoTool', () => {
  // Legacy `useLassoSelect` hook removed. Drag flows
  // entirely through `lassoSelectAction` via the gesture dispatcher; the
  // tool itself only declares id/keybinding/cursor/presentation + the
  // dispatcher binding. The route-table drag entry is gone, so tests that
  // exercised `tool.drag.onStart/onMove/onEnd` directly are also gone —
  // those paths are covered by `lassoSelectAction`'s own tests.
  it("declares id 'lasso' and keybinding { key: 'L' } by default", () => {
    const { result } = renderHook(() => useLassoTool());
    expect(result.current.id).toBe('lasso');
    expect(result.current.keybinding).toEqual({ key: 'L' });
  });

  it("keybinding override: passing keybinding: null omits it", () => {
    const { result } = renderHook(() => useLassoTool({ keybinding: null }));
    expect(result.current.keybinding).toBeUndefined();
  });

  it("custom keybinding passes through", () => {
    const { result } = renderHook(() => useLassoTool({ keybinding: { key: 'L', shift: true } }));
    expect(result.current.keybinding).toEqual({ key: 'L', shift: true });
  });

  it('declares the dispatcher binding for lassoSelect', () => {
    const { result } = renderHook(() => useLassoTool());
    const bindings = result.current.bindings ?? [];
    expect(bindings.length).toBe(1);
    expect(bindings[0].actionId).toBe('lassoSelect');
    expect(bindings[0].spec.kind).toBe('drag');
  });

  it('hands its hit mode to the action through the binding params', () => {
    const { result, rerender } = renderHook(
      ({ mode }: { mode?: 'centers' | 'intersect' | 'enclosed' }) => useLassoTool({ mode }),
      { initialProps: {} },
    );
    const params = () => resolveParams(result.current.bindings![0].opts?.params);
    expect(params()).toEqual({ mode: 'intersect' });
    rerender({ mode: 'enclosed' });
    expect(params()).toEqual({ mode: 'enclosed' });
  });

  it('hands its vertex spacing to the action through the binding params', () => {
    const { result, rerender } = renderHook(
      ({ minVertexSpacing }: { minVertexSpacing?: number }) => useLassoTool({ minVertexSpacing }),
      { initialProps: {} },
    );
    const params = () => resolveParams(result.current.bindings![0].opts?.params);
    expect(params()).toEqual({ mode: 'intersect' });
    rerender({ minVertexSpacing: 0 });
    expect(params()).toEqual({ mode: 'intersect', minVertexSpacing: 0 });
  });

  it('hands its behaviors to the action through the binding, and none when given none', () => {
    const behaviors = [{ onEnd: () => undefined }];
    const withSome = renderHook(() => useLassoTool({ behaviors }));
    expect(withSome.result.current.bindings![0].opts?.behaviors).toBe(behaviors);
    const withNone = renderHook(() => useLassoTool());
    expect(withNone.result.current.bindings![0].opts?.behaviors).toBeUndefined();
  });

  it('the params thunk reads the committed mode, not an abandoned render\'s', () => {
    let tool = null as Tool<undefined> | null;
    function Probe({ mode }: { mode: 'intersect' | 'enclosed' }) {
      tool = useLassoTool({ mode });
      return null;
    }
    renderThenAbandon<'intersect' | 'enclosed'>('intersect', 'enclosed', (mode) => <Probe mode={mode} />);
    expect(resolveParams(tool!.bindings![0].opts?.params)).toEqual({ mode: 'intersect' });
  });
});
