/**
 * Provider for the active paints (fill / stroke / focus). The fill and stroke
 * are the shape tools' shared `fill` and `stroke` options, held in a
 * `ToolOptionValues`, so a swatch pick is what the next shape is drawn with.
 * Mount once near the root and read it below with `useColorContext()`; its
 * keys are `colorContribution`, in `contribution.ts`.
 */
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { DEFAULT_FILL, DEFAULT_STROKE, type ActivePaint } from '../../newShapePaint';
import { solidColorOf } from '@weasel-js/paint';
import {
  createToolOptionValues, DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, getAlpha01, mergeAlphaFromPrev, SHARED_TOOL_OPTIONS,
  toHex8, useLatest, withAlpha01, type ToolOptionValues,
} from '@weasel-js/core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Full API surface exposed via `useColorContext()`. */
export interface ColorContextValue {
  // Active-paint state
  fill: ActivePaint;
  stroke: ActivePaint;
  focused: 'fill' | 'stroke';
  setFill: (p: ActivePaint) => void;
  setStroke: (p: ActivePaint) => void;
  setFocused: (p: ActivePaint) => void;
  setFocus: (which: 'fill' | 'stroke') => void;
  setFillColor: (color: string) => void;
  setStrokeColor: (color: string) => void;
  setFocusedColor: (color: string) => void;
  focusedAlpha: number;
  setFocusedAlpha: (alpha01: number) => void;
  swap: () => void;
  swapFocus: () => void;
  toggleFocusedNone: () => void;
  reset: () => void;
}

export interface ColorContextProviderProps {
  /** Where the fill and stroke are kept, as the shared `fill` and `stroke` tool options. Default: a store of its
   *  own, starting at `initialFill` and `initialStroke`. */
  values?: ToolOptionValues;
  /** The fill while `values` holds none. */
  initialFill?: ActivePaint;
  initialStroke?: ActivePaint;
  initialFocus?: 'fill' | 'stroke';
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Paints {
  fill: ActivePaint;
  stroke: ActivePaint;
}

type PaintSlot = keyof Paints;

/**
 * `color` as the `slot` swatch takes it from a picker, normalized to `#rrggbbaa`: a 6-digit color
 * keeps the alpha `paint` already has, since the native picker has none, and an 8-digit one wins
 * outright.
 */
export function colorKeepingAlpha(slot: PaintSlot, paint: ActivePaint, color: string): string {
  if (color.length === 9) return color;
  return mergeAlphaFromPrev(color, solidColorOf(paint) ?? (slot === 'fill' ? DEFAULT_FILL_COLOR : DEFAULT_STROKE_COLOR));
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ColorContextContext = createContext<ColorContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const paintOf = (held: unknown, fallback: ActivePaint): ActivePaint => (held === undefined ? fallback : (held as ActivePaint));

export function ColorContextProvider({
  values: given,
  initialFill,
  initialStroke,
  initialFocus,
  children,
}: ColorContextProviderProps) {
  const [own] = useState(createToolOptionValues);
  const values = given ?? own;
  const startFill = initialFill ?? DEFAULT_FILL;
  const startStroke = initialStroke ?? DEFAULT_STROKE;
  const shared = useSyncExternalStore(values.subscribe, () => values.get(SHARED_TOOL_OPTIONS));
  const fill = paintOf(shared.fill, startFill);
  const stroke = paintOf(shared.stroke, startStroke);
  const [focused, setFocus] = useState<'fill' | 'stroke'>(initialFocus ?? 'fill');

  /** Write the paints `next` makes of the ones held now: an updater reads the store, so two in one act() compose. */
  const setPaints = useCallback((next: Paints | ((cur: Paints) => Paints)) => {
    const held = values.get(SHARED_TOOL_OPTIONS);
    const cur = { fill: paintOf(held.fill, startFill), stroke: paintOf(held.stroke, startStroke) };
    const out = typeof next === 'function' ? next(cur) : next;
    if (out.fill !== cur.fill) values.set(SHARED_TOOL_OPTIONS, 'fill', out.fill);
    if (out.stroke !== cur.stroke) values.set(SHARED_TOOL_OPTIONS, 'stroke', out.stroke);
  }, [values, startFill, startStroke]);

  const focusedRef = useLatest(focused);

  const setFill = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, fill: p }));
  }, [setPaints]);
  const setStroke = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, stroke: p }));
  }, [setPaints]);

  const setFocused = useCallback((p: ActivePaint) => {
    if (focusedRef.current === 'fill') setPaints((cur) => ({ ...cur, fill: p }));
    else setPaints((cur) => ({ ...cur, stroke: p }));
  }, [focusedRef, setPaints]);

  const setSlotColor = useCallback((slot: PaintSlot, color: string) => {
    setPaints((cur) => ({ ...cur, [slot]: { kind: 'solid', color: colorKeepingAlpha(slot, cur[slot], color) } }));
  }, [setPaints]);
  const setFillColor = useCallback((color: string) => setSlotColor('fill', color), [setSlotColor]);
  const setStrokeColor = useCallback((color: string) => setSlotColor('stroke', color), [setSlotColor]);
  const setFocusedColor = useCallback((color: string) => setSlotColor(focusedRef.current, color), [setSlotColor, focusedRef]);

  const focusedPaint = focused === 'fill' ? fill : stroke;
  const focusedColor = solidColorOf(focusedPaint);
  const focusedAlpha = focusedColor === undefined ? 1 : getAlpha01(focusedColor);
  const setFocusedAlpha = useCallback((alpha01: number) => {
    setPaints((cur) => {
      const which = focusedRef.current;
      const paint = which === 'fill' ? cur.fill : cur.stroke;
      const color = solidColorOf(paint);
      if (color === undefined) return cur;
      const next: ActivePaint = { kind: 'solid', color: withAlpha01(toHex8(color), alpha01) };
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, [focusedRef, setPaints]);

  const swap = useCallback(() => {
    setPaints((cur) => ({ fill: cur.stroke, stroke: cur.fill }));
  }, [setPaints]);
  const swapFocus = useCallback(() => {
    setFocus((cur) => (cur === 'fill' ? 'stroke' : 'fill'));
  }, [setFocus]);
  const toggleFocusedNone = useCallback(() => {
    setPaints((cur) => {
      const which = focusedRef.current;
      const paint = which === 'fill' ? cur.fill : cur.stroke;
      const next: ActivePaint = paint === null ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE) : null;
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, [focusedRef, setPaints]);
  const reset = useCallback(() => {
    setPaints({ fill: DEFAULT_FILL, stroke: DEFAULT_STROKE });
  }, [setPaints]);

  const value = useMemo<ColorContextValue>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, reset,
  }), [
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, reset,
  ]);

  return (
    <ColorContextContext.Provider value={value}>
      {children}
    </ColorContextContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useColorContext(): ColorContextValue {
  const v = useContext(ColorContextContext);
  if (!v) {
    throw new Error('useColorContext must be used inside <ColorContextProvider>');
  }
  return v;
}
