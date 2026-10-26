import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { activeModeOf, NORMAL, type ActiveMode } from '@weasel-js/modes';
import { DEFAULT_ALLOWED_CAPABILITIES, DEFAULT_DEVICE_PROFILE, resolveDeviceProfile } from '@weasel-js/routing';
import { asNodeId } from '../../core/scene/types';
import { never } from './conditions';
import {
  surfaceRuleCtx,
  useChromeCaps,
  type ChromeCapsSource,
  type SurfaceRuleInputs,
  type ViewRuleInputs,
} from './useChromeCaps';

const A = asNodeId('a');
const B = asNodeId('b');

const SURFACE: SurfaceRuleInputs = {
  focused: true, hover: null, mode: undefined, resizable: undefined,
  editingAnchors: false, device: DEFAULT_DEVICE_PROFILE,
};
const view = (over: Partial<ViewRuleInputs> = {}): ViewRuleInputs => ({
  selection: [], view: { x: 0, y: 0, scale: { x: 1, y: 1 } }, action: { kind: null, id: null }, ...over,
});
const EDIT: ActiveMode = { id: 'edit', allowedCapabilities: new Set(['edits-anchors']) as ActiveMode['allowedCapabilities'] };

describe('surfaceRuleCtx', () => {
  it('takes selection, action and zoom from the view', () => {
    const action = { kind: 'marquee', id: 'p1' };
    const ctx = surfaceRuleCtx(SURFACE, view({ selection: [A], action, view: { x: 5, y: 5, scale: { x: 2, y: 2 } } }));
    expect(ctx.selection).toEqual([A]);
    expect(ctx.action).toBe(action);
    expect(ctx.zoom).toBe(2);
  });

  it('derives multiActive from the selection', () => {
    expect(surfaceRuleCtx(SURFACE, view({ selection: [A] })).multiActive).toBe(false);
    expect(surfaceRuleCtx(SURFACE, view({ selection: [A, B] })).multiActive).toBe(true);
  });

  it('behaves as normal mode, capabilities included, when the surface has no mode', () => {
    const ctx = surfaceRuleCtx(SURFACE, view());
    expect(ctx.mode).toBe('normal');
    expect(ctx.allowedCapabilities).toBe(DEFAULT_ALLOWED_CAPABILITIES);
  });

  it('carries the active mode and what it allows', () => {
    const ctx = surfaceRuleCtx({ ...SURFACE, mode: EDIT }, view());
    expect(ctx.mode).toBe('edit');
    expect(ctx.allowedCapabilities).toBe(EDIT.allowedCapabilities);
  });

  it('calls the selection resizable only when every selected node is, and says nothing without a predicate', () => {
    const resizable = (id: string) => id !== 'b';
    expect(surfaceRuleCtx(SURFACE, view({ selection: [A, B] })).selectionResizable).toBeUndefined();
    expect(surfaceRuleCtx({ ...SURFACE, resizable }, view({ selection: [A] })).selectionResizable).toBe(true);
    expect(surfaceRuleCtx({ ...SURFACE, resizable }, view({ selection: [A, B] })).selectionResizable).toBe(false);
  });

  it('carries focus, hover, anchor editing and the device, and reports no modifier held', () => {
    const device = resolveDeviceProfile({ coarsePointer: true, canHover: false, dpr: 2 });
    const ctx = surfaceRuleCtx({ ...SURFACE, focused: false, hover: A, editingAnchors: true, device }, view());
    expect(ctx.focused).toBe(false);
    expect(ctx.hover).toBe(A);
    expect(ctx.editingAnchors).toBe(true);
    expect(ctx.device).toBe(device);
    expect(ctx.modifiers).toEqual({ alt: false, ctrl: false, meta: false, shift: false });
  });
});

describe('useChromeCaps', () => {
  const source = (over: Partial<ChromeCapsSource> = {}): ChromeCapsSource => ({
    rules: undefined, getMode: undefined, getFocused: undefined, getHover: () => null,
    resizable: undefined, editingAnchors: () => false, device: DEFAULT_DEVICE_PROFILE, ...over,
  });

  it('keeps one object across renders and answers from the latest source', () => {
    const { result, rerender } = renderHook((s: ChromeCapsSource) => useChromeCaps(s), { initialProps: source() });
    const first = result.current;
    expect(first.isVisible(view({ selection: [A] }))('selection.outline')).toBe(true);

    rerender(source({ rules: { 'selection.outline': never } }));
    expect(result.current).toBe(first);
    expect(first.isVisible(view({ selection: [A] }))('selection.outline')).toBe(false);
  });

  it('gives no rule context until a mode registry is wired, and visibility either way', () => {
    const normal = activeModeOf(NORMAL);
    const { result, rerender } = renderHook((s: ChromeCapsSource) => useChromeCaps(s), { initialProps: source() });
    expect(result.current.ruleCtx(view())).toBeUndefined();
    expect(result.current.isVisible(view({ selection: [A] }))('selection.resize-handles')).toBe(true);

    rerender(source({ getMode: () => normal }));
    expect(result.current.ruleCtx(view())).toMatchObject({ mode: normal.id, allowedCapabilities: normal.allowedCapabilities });
  });

  it('counts the surface as focused unless told otherwise, and reads the rest when asked', () => {
    let hover: ReturnType<typeof asNodeId> | null = null;
    let editing = false;
    const { result, rerender } = renderHook((s: ChromeCapsSource) => useChromeCaps(s), {
      initialProps: source({ getMode: () => EDIT, getHover: () => hover, editingAnchors: () => editing }),
    });
    expect(result.current.ruleCtx(view())).toMatchObject({ focused: true, hover: null, editingAnchors: false });
    hover = A;
    editing = true;
    expect(result.current.ruleCtx(view())).toMatchObject({ hover: A, editingAnchors: true });

    rerender(source({ getMode: () => EDIT, getFocused: () => false }));
    expect(result.current.ruleCtx(view())!.focused).toBe(false);
  });
});
