/**
 * State-holding provider for the active paints (fill / stroke / focus).
 * Mount once near the root and read it below with `useColorContext()`; its
 * keys are `colorContribution`, in `contribution.ts`.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ActivePaint } from '../../ActiveSwatches';
import { DEFAULT_FILL, DEFAULT_STROKE } from '../../ActiveSwatches';
import { solidColorOf } from '@weasel-js/ui/paint-value';
import { DEFAULT_FILL_COLOR, DEFAULT_STROKE_COLOR, getAlpha01, mergeAlphaFromPrev, toHex8, useLatest, withAlpha01 } from '@weasel-js/core';

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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ColorContextContext = createContext<ColorContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ColorContextProvider({
  initialFill,
  initialStroke,
  initialFocus,
  children,
}: ColorContextProviderProps) {
  // Combine fill+stroke into one state so `swap` can atomically exchange
  // them via a functional updater — this ensures swap composes correctly
  // when batched with setFillColor/setStrokeColor in the same act() call.
  const [paints, setPaints] = useState<Paints>({
    fill: initialFill ?? DEFAULT_FILL,
    stroke: initialStroke ?? DEFAULT_STROKE,
  });
  const [focused, setFocus] = useState<'fill' | 'stroke'>(initialFocus ?? 'fill');

  const { fill, stroke } = paints;

  const focusedRef = useLatest(focused);

  const setFill = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, fill: p }));
  }, []);
  const setStroke = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, stroke: p }));
  }, []);

  const setFocused = useCallback((p: ActivePaint) => {
    if (focusedRef.current === 'fill') setPaints((cur) => ({ ...cur, fill: p }));
    else setPaints((cur) => ({ ...cur, stroke: p }));
  }, [focusedRef]);

  // Normalize incoming color strings to `#rrggbbaa`. 6-char inputs
  // inherit the previous swatch's alpha (the native picker round-trip)
  // — 8-char inputs win outright.
  const setFillColor = useCallback((color: string) => {
    setPaints((cur) => {
      const prev = solidColorOf(cur.fill) ?? DEFAULT_FILL_COLOR;
      return { ...cur, fill: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
    });
  }, []);
  const setStrokeColor = useCallback((color: string) => {
    setPaints((cur) => {
      const prev = solidColorOf(cur.stroke) ?? DEFAULT_STROKE_COLOR;
      return { ...cur, stroke: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
    });
  }, []);
  const setFocusedColor = useCallback((color: string) => {
    setPaints((cur) => {
      const which = focusedRef.current;
      if (which === 'fill') {
        const prev = solidColorOf(cur.fill) ?? DEFAULT_FILL_COLOR;
        return { ...cur, fill: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
      } else {
        const prev = solidColorOf(cur.stroke) ?? DEFAULT_STROKE_COLOR;
        return { ...cur, stroke: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
      }
    });
  }, [focusedRef]);

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
  }, [focusedRef]);

  const swap = useCallback(() => {
    setPaints((cur) => ({ fill: cur.stroke, stroke: cur.fill }));
  }, []);
  const swapFocus = useCallback(() => {
    setFocus((cur) => (cur === 'fill' ? 'stroke' : 'fill'));
  }, []);
  const toggleFocusedNone = useCallback(() => {
    setPaints((cur) => {
      const which = focusedRef.current;
      const paint = which === 'fill' ? cur.fill : cur.stroke;
      const next: ActivePaint = paint === null ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE) : null;
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, [focusedRef]);
  const reset = useCallback(() => {
    setPaints({ fill: DEFAULT_FILL, stroke: DEFAULT_STROKE });
  }, []);

  const value = useMemo<ColorContextValue>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, reset,
  }), [
    fill, stroke, focused,
    setFill, setStroke, setFocused,
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
