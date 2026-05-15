/**
 * Active fill / stroke / focus state, plus the action keybindings that
 * mutate them (D = reset, X = swap colors, Shift+X = swap focus, / =
 * toggle focused swatch between solid and `none`).
 *
 * Centralizes what App.tsx used to do inline so that:
 *   - color sources (swatch grids, palettes, eyedropper) dispatch
 *     through one interface (`setFill` / `setStroke` / `setFocused`)
 *     instead of poking individual setters,
 *   - the keybindings live next to the state they mutate (no more
 *     scattered `useAction` calls in App.tsx for color-related bindings),
 *   - ad-hoc focus-routing logic ("if focused === 'fill' setFill else
 *     setStroke") collapses into a single `setFocused(paint)` call.
 *
 * Pass `registerActions: false` to suppress the keybinding registrations
 * (e.g. when mounting a second instance for a sub-surface).
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useAction } from '@orochi235/weasel';
import type { ActivePaint } from './ActiveSwatches';
import { DEFAULT_FILL, DEFAULT_STROKE } from './ActiveSwatches';

export interface ActiveColorsApi {
  fill: ActivePaint;
  stroke: ActivePaint;
  focused: 'fill' | 'stroke';
  setFill: (p: ActivePaint) => void;
  setStroke: (p: ActivePaint) => void;
  /** Set whichever swatch is currently focused. The most common entry
   *  point for swatch grids / palettes / the eyedropper. */
  setFocused: (p: ActivePaint) => void;
  /** Move focus between the two swatches without touching colors. */
  setFocus: (which: 'fill' | 'stroke') => void;
  /** Convenience setters for the common solid-color path — wrap the
   *  string in `{ kind: 'solid', color }` so call-sites don't have to. */
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setFocusedColor: (color: string) => void;
  /** Swap fill ↔ stroke colors (the X action). */
  swap: () => void;
  /** Swap which swatch is focused (Shift+X). Colors stay put. */
  swapFocus: () => void;
  /** Toggle the focused swatch between its current paint and `none`. */
  toggleFocusedNone: () => void;
  /** Toggle the focused swatch between its current paint and `transparent`. */
  toggleFocusedTransparent: () => void;
  /** Restore black stroke / white fill defaults (the D action). */
  reset: () => void;
}

export interface UseActiveColorsOptions {
  initialFill?: ActivePaint;
  initialStroke?: ActivePaint;
  initialFocus?: 'fill' | 'stroke';
  /** Default true — registers D / X / Shift+X / / keybindings into the
   *  surrounding ActionsProvider. */
  registerActions?: boolean;
}

export function useActiveColors(opts: UseActiveColorsOptions = {}): ActiveColorsApi {
  const [fill, setFill] = useState<ActivePaint>(opts.initialFill ?? DEFAULT_FILL);
  const [stroke, setStroke] = useState<ActivePaint>(opts.initialStroke ?? DEFAULT_STROKE);
  const [focused, setFocus] = useState<'fill' | 'stroke'>(opts.initialFocus ?? 'fill');

  // Refs so the keybinding actions read the latest state without
  // re-registering on every state change.
  const fillRef = useRef(fill); fillRef.current = fill;
  const strokeRef = useRef(stroke); strokeRef.current = stroke;
  const focusedRef = useRef(focused); focusedRef.current = focused;

  const setFocused = useCallback((p: ActivePaint) => {
    if (focusedRef.current === 'fill') setFill(p);
    else setStroke(p);
  }, []);

  const setFillColor = useCallback((color: string) => {
    setFill({ kind: 'solid', color });
  }, []);
  const setStrokeColor = useCallback((color: string) => {
    setStroke({ kind: 'solid', color });
  }, []);
  const setFocusedColor = useCallback((color: string) => {
    setFocused({ kind: 'solid', color });
  }, [setFocused]);

  const swap = useCallback(() => {
    const f = fillRef.current;
    const s = strokeRef.current;
    setFill(s);
    setStroke(f);
  }, []);
  const swapFocus = useCallback(() => {
    setFocus((cur) => (cur === 'fill' ? 'stroke' : 'fill'));
  }, []);
  const toggleFocusedNone = useCallback(() => {
    const which = focusedRef.current;
    const cur = which === 'fill' ? fillRef.current : strokeRef.current;
    const next: ActivePaint = cur.kind === 'none'
      ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
      : { kind: 'none' };
    if (which === 'fill') setFill(next); else setStroke(next);
  }, []);
  const toggleFocusedTransparent = useCallback(() => {
    const which = focusedRef.current;
    const cur = which === 'fill' ? fillRef.current : strokeRef.current;
    const next: ActivePaint = cur.kind === 'transparent'
      ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
      : { kind: 'transparent' };
    if (which === 'fill') setFill(next); else setStroke(next);
  }, []);
  const reset = useCallback(() => {
    setFill(DEFAULT_FILL);
    setStroke(DEFAULT_STROKE);
  }, []);

  const enableActions = opts.registerActions !== false;

  // Action registrations — `useAction` is conditional on `enableActions`,
  // but we register the same id with `enabled: false` rather than skipping
  // the call so React's hook order stays stable across renders.
  useAction(useMemo(() => ({
    id: 'swill.swatches.reset',
    label: 'Reset fill/stroke to defaults',
    defaultBinding: { key: 'd' },
    run: reset,
    enabled: () => enableActions ? true : 'not-applicable' as const,
  }), [reset, enableActions]));
  useAction(useMemo(() => ({
    id: 'swill.swatches.swap',
    label: 'Swap fill and stroke',
    defaultBinding: { key: 'x' },
    run: swap,
    enabled: () => enableActions ? true : 'not-applicable' as const,
  }), [swap, enableActions]));
  useAction(useMemo(() => ({
    id: 'swill.swatches.swapFocus',
    label: 'Swap focused swatch',
    defaultBinding: { key: 'x', shift: true },
    run: swapFocus,
    enabled: () => enableActions ? true : 'not-applicable' as const,
  }), [swapFocus, enableActions]));
  useAction(useMemo(() => ({
    id: 'swill.swatches.none',
    label: 'Toggle focused swatch / none',
    defaultBinding: { key: '/' },
    run: toggleFocusedNone,
    enabled: () => enableActions ? true : 'not-applicable' as const,
  }), [toggleFocusedNone, enableActions]));

  return useMemo<ActiveColorsApi>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused,
    setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
  }), [
    fill, stroke, focused,
    setFocused, setFillColor, setStrokeColor, setFocusedColor,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
  ]);
}
