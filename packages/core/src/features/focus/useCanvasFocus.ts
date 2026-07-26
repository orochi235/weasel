/**
 * Track DOM focus on a canvas (or any focusable host element). Returns the
 * live `focused` boolean, props to spread onto the focusable element, and a
 * stable `getFocused()` getter for use inside per-frame closures (notably
 * `RenderLayer.draw`, which is constructed once but called every frame).
 *
 * Pure feature module — no Canvas/SceneCanvas integration. Consumers compose
 * the hook + `gateLayer` (or their own gate) to hide affordances when blurred.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseCanvasFocusOptions {
  /** Initial focus state. Default `false` — handles hidden until first click. */
  initial?: boolean;
  /** `tabIndex` to set on the focusable element. Default `0` (focusable in
   *  document tab order). Set to `-1` for programmatic-only focus. */
  tabIndex?: number;
}

export interface CanvasFocusReturn {
  /** Live boolean — true when the element has DOM focus. Triggers re-renders
   *  when the focus state changes (set via React state). */
  focused: boolean;
  /** Spread onto the focusable element (e.g. the canvas). Includes
   *  `tabIndex`, `onFocus`, `onBlur`. */
  focusProps: {
    tabIndex: number;
    onFocus: () => void;
    onBlur: () => void;
  };
  /** Stable getter for the live focused state. Use inside per-frame closures
   *  like `RenderLayer.draw`, where the layer is constructed once and
   *  reading `focused` directly would capture the value at construction
   *  time. The getter always returns the current value. */
  getFocused: () => boolean;
  /** Imperative focus / blur. Useful for tests and programmatic control. */
  setFocused: (next: boolean) => void;
}

export function useCanvasFocus(options: UseCanvasFocusOptions = {}): CanvasFocusReturn {
  const { initial = false, tabIndex = 0 } = options;
  const [focused, setFocusedState] = useState<boolean>(initial);
  const focusedRef = useRef<boolean>(initial);
  focusedRef.current = focused;

  const onFocus = useCallback(() => {
    if (!focusedRef.current) {
      focusedRef.current = true;
      setFocusedState(true);
    }
  }, []);
  const onBlur = useCallback(() => {
    if (focusedRef.current) {
      focusedRef.current = false;
      setFocusedState(false);
    }
  }, []);
  const getFocused = useCallback(() => focusedRef.current, []);
  const setFocused = useCallback((next: boolean) => {
    if (focusedRef.current === next) return;
    focusedRef.current = next;
    setFocusedState(next);
  }, []);

  // Latest tabIndex without re-creating focusProps every render.
  const tabIndexRef = useRef(tabIndex);
  tabIndexRef.current = tabIndex;

  // focusProps must remain referentially stable so it can be spread onto
  // memoized elements without retriggering downstream effects.
  const focusPropsRef = useRef({ tabIndex, onFocus, onBlur });
  focusPropsRef.current = { tabIndex, onFocus, onBlur };
  // The object reference can change when tabIndex changes; that's fine —
  // the canvas's tabIndex updates accordingly.
  useEffect(() => {
    focusPropsRef.current = { tabIndex, onFocus, onBlur };
  }, [tabIndex, onFocus, onBlur]);

  return {
    focused,
    focusProps: focusPropsRef.current,
    getFocused,
    setFocused,
  };
}
