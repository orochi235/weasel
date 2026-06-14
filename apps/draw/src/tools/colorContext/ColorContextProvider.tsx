/**
 * State-holding provider for active-paint context (fill / stroke / focus).
 *
 * Extracted from `useColorContextTool` as part of Phase 9 of the registry
 * unification refactor. The "tool" concern (keybinding registration via the
 * old `defineTool` wrapper) is replaced by three immediate-action descriptors
 * in `actions.ts`; the state cluster lives here.
 *
 * Mount once near the root:
 *   <ColorContextProvider>
 *     <ColorDepBridge />
 *     <App />
 *   </ColorContextProvider>
 *
 * Consume anywhere below:
 *   const color = useColorContext();
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ActivePaint } from '../../ActiveSwatches';
import { DEFAULT_FILL, DEFAULT_STROKE } from '../../ActiveSwatches';
import { getAlpha01, mergeAlphaFromPrev, toHex8, withAlpha01 } from '@weasel-js/core';

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
  toggleFocusedTransparent: () => void;
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

  const paintsRef = useRef(paints); paintsRef.current = paints;
  const focusedRef = useRef(focused); focusedRef.current = focused;

  const setFill = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, fill: p }));
  }, []);
  const setStroke = useCallback((p: ActivePaint) => {
    setPaints((cur) => ({ ...cur, stroke: p }));
  }, []);

  const setFocused = useCallback((p: ActivePaint) => {
    if (focusedRef.current === 'fill') setPaints((cur) => ({ ...cur, fill: p }));
    else setPaints((cur) => ({ ...cur, stroke: p }));
  }, []);

  // Normalize incoming color strings to `#rrggbbaa`. 6-char inputs
  // inherit the previous swatch's alpha (the native picker round-trip)
  // — 8-char inputs win outright.
  const setFillColor = useCallback((color: string) => {
    setPaints((cur) => {
      const prev = cur.fill.kind === 'solid' ? cur.fill.color : '#ffffffff';
      return { ...cur, fill: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
    });
  }, []);
  const setStrokeColor = useCallback((color: string) => {
    setPaints((cur) => {
      const prev = cur.stroke.kind === 'solid' ? cur.stroke.color : '#000000ff';
      return { ...cur, stroke: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
    });
  }, []);
  const setFocusedColor = useCallback((color: string) => {
    setPaints((cur) => {
      const which = focusedRef.current;
      if (which === 'fill') {
        const prev = cur.fill.kind === 'solid' ? cur.fill.color : '#ffffffff';
        return { ...cur, fill: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
      } else {
        const prev = cur.stroke.kind === 'solid' ? cur.stroke.color : '#000000ff';
        return { ...cur, stroke: { kind: 'solid', color: color.length === 9 ? color : mergeAlphaFromPrev(color, prev) } };
      }
    });
  }, []);

  const focusedPaint = focused === 'fill' ? fill : stroke;
  const focusedAlpha = focusedPaint.kind === 'solid' ? getAlpha01(focusedPaint.color) : 1;
  const setFocusedAlpha = useCallback((alpha01: number) => {
    setPaints((cur) => {
      const which = focusedRef.current;
      const paint = which === 'fill' ? cur.fill : cur.stroke;
      if (paint.kind !== 'solid') return cur;
      const next: ActivePaint = { kind: 'solid', color: withAlpha01(toHex8(paint.color), alpha01) };
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, []);

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
      const next: ActivePaint = paint.kind === 'none'
        ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
        : { kind: 'none' };
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, []);
  const toggleFocusedTransparent = useCallback(() => {
    setPaints((cur) => {
      const which = focusedRef.current;
      const paint = which === 'fill' ? cur.fill : cur.stroke;
      const next: ActivePaint = paint.kind === 'transparent'
        ? (which === 'fill' ? DEFAULT_FILL : DEFAULT_STROKE)
        : { kind: 'transparent' };
      return which === 'fill' ? { ...cur, fill: next } : { ...cur, stroke: next };
    });
  }, []);
  const reset = useCallback(() => {
    setPaints({ fill: DEFAULT_FILL, stroke: DEFAULT_STROKE });
  }, []);

  const value = useMemo<ColorContextValue>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
  }), [
    fill, stroke, focused,
    setFill, setStroke, setFocused,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
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
