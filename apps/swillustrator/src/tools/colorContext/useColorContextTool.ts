/**
 * Hook owner of swillustrator's active-paint state (fill / stroke /
 * focus) plus the scene-write methods that propagate paint to the
 * current selection. Returns `{ tool, api }` — the Tool registers
 * keybindings (D / X / Shift-X / `/`) in the kit's ambient list; the
 * api is the single imperative surface for any color-change caller
 * (UI via React context, other tools via direct closure).
 *
 * Lifted from the old `useActiveColors` hook (state cluster) and from
 * `App.tsx`'s applyFillToSelection / applyStrokeToSelection /
 * applyStrokeWidthToSelection closures (scene-write cluster). Adding
 * a method here is the supported way to extend the color-change API.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool, claim } from '@orochi235/weasel/routing';
import type { Tool } from '@orochi235/weasel';
import type { ActivePaint } from '../../ActiveSwatches';
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  getAlpha01,
  mergeAlphaFromPrev,
  toHex8,
  withAlpha01,
} from '../../ActiveSwatches';
import type { Obj } from '../../poseUpdate';

export interface ColorContextApi {
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
  // Scene-write routing (filled in by Task 3).
  applyFillToSelection: (color: string) => void;
  applyStrokeToSelection: (color: string) => void;
  applyStrokeWidthToSelection: (w: number) => void;
}

export interface UseColorContextToolOptions {
  initialFill?: ActivePaint;
  initialStroke?: ActivePaint;
  initialFocus?: 'fill' | 'stroke';
  /** Scene-write seam: matches App.tsx's `updateSelected(patch, label?)`.
   *  The hook delegates each `apply*ToSelection` call through here so
   *  the existing undo capture + label semantics carry through. */
  updateSelected: (patch: (o: Obj) => Obj, label?: string) => void;
}

interface Paints {
  fill: ActivePaint;
  stroke: ActivePaint;
}

export function useColorContextTool(opts: UseColorContextToolOptions): {
  tool: Tool<null>;
  api: ColorContextApi;
} {
  // Combine fill+stroke into one state so `swap` can atomically exchange
  // them via a functional updater — this ensures swap composes correctly
  // when batched with setFillColor/setStrokeColor in the same act() call.
  const [paints, setPaints] = useState<Paints>({
    fill: opts.initialFill ?? DEFAULT_FILL,
    stroke: opts.initialStroke ?? DEFAULT_STROKE,
  });
  const [focused, setFocus] = useState<'fill' | 'stroke'>(opts.initialFocus ?? 'fill');

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

  const applyFillToSelection = useCallback((color: string) => {
    const merge = (prev: string | undefined): string =>
      color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#ffffffff');
    opts.updateSelected((o) => {
      if (o.tool !== 'text') return { ...o, fill: merge(o.fill) };
      const prevFill = o.style?.fill;
      const prevColor = prevFill && prevFill.fill === 'solid' ? prevFill.color : undefined;
      const next = merge(prevColor);
      const nextFill = prevFill && prevFill.fill === 'solid'
        ? { ...prevFill, color: next }
        : { fill: 'solid' as const, color: next };
      return { ...o, style: { ...(o.style ?? {}), fill: nextFill } };
    }, 'Set fill');
  }, [opts]);

  const applyStrokeToSelection = useCallback((color: string) => {
    const merge = (prev: string | undefined): string =>
      color.length === 9 ? color : mergeAlphaFromPrev(color, prev ?? '#000000ff');
    opts.updateSelected(
      (o) => (o.tool !== 'text' ? { ...o, stroke: merge(o.stroke) } : o),
      'Set stroke',
    );
  }, [opts]);

  const applyStrokeWidthToSelection = useCallback((w: number) => {
    opts.updateSelected(
      (o) => (o.tool !== 'text' ? { ...o, strokeWidth: w } : o),
      'Set stroke width',
    );
  }, [opts]);

  // Refs so the keyDown closures see the latest api setters without
  // re-creating the tool on every render.
  const apiRef = useRef<ColorContextApi | null>(null);

  const tool = useMemo<Tool<null>>(() => defineTool<null>({
    id: 'color-context',
    presentation: {
      label: 'Color context',
      group: 'view',
    },
    initial: {
      keyDown: {
        d: () => { apiRef.current?.reset(); return claim(); },
        x: (ctx: { modifiers: { shift: boolean } }) => {
          if (ctx.modifiers.shift) apiRef.current?.swapFocus();
          else apiRef.current?.swap();
          return claim();
        },
        '/': () => { apiRef.current?.toggleFocusedNone(); return claim(); },
      },
    },
  }), []);

  const api = useMemo<ColorContextApi>(() => ({
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFocus,
    setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
    applyFillToSelection, applyStrokeToSelection, applyStrokeWidthToSelection,
  }), [
    fill, stroke, focused,
    setFill, setStroke, setFocused, setFillColor, setStrokeColor, setFocusedColor,
    focusedAlpha, setFocusedAlpha,
    swap, swapFocus, toggleFocusedNone, toggleFocusedTransparent, reset,
    applyFillToSelection, applyStrokeToSelection, applyStrokeWidthToSelection,
  ]);

  apiRef.current = api;
  return { tool, api };
}
