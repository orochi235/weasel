/**
 * Color-context action descriptors — Phase 9 of registry unification.
 *
 * Three immediate-action descriptors that replace the D / X / Shift-X / /
 * keybindings that used to live in `useColorContextTool`'s `defineTool`
 * wrapper. Keybindings now flow through the gesture dispatcher.
 *
 * Each descriptor declares `requires: ['color']`; at dispatch time the
 * dispatcher reads the live `color` dep from the `DepRegistry` (registered
 * by `<ColorDepBridge>` in App.tsx via `useDepSource('color', ...)`) and
 * passes it to `invoker.run`.
 */

// Side-effect import: augments DepSchema with `color: ColorContextValue`.
import './depSchemaAugmentation';

import type { Action } from '@orochi235/weasel';
import type { ActionDeps } from '@orochi235/weasel';
import type { ColorContextValue } from './ColorContextProvider';

// ---------------------------------------------------------------------------
// Typed deps bag for color actions
// ---------------------------------------------------------------------------

interface ColorDeps extends ActionDeps {
  color?: ColorContextValue;
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

/** Reset fill to white and stroke to black (D key). */
export const colorResetAction: Action & { requires: string[] } = {
  id: 'color.reset',
  label: 'Reset colors',
  defaultBinding: { key: 'd' },
  gestureBinding: { kind: 'key', key: 'd' },
  requires: ['color'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps) => {
      (deps as ColorDeps).color?.reset();
    },
  },
};

/**
 * Swap fill/stroke (X key) or swap focused side (Shift+X).
 *
 * Two `BoundGesture` entries on a single descriptor let the dispatcher
 * distinguish the two bindings via `opts.params`. The `run` body reads
 * `params.kind` to pick the right method.
 */
export const colorSwapAction: Action & { requires: string[] } = {
  id: 'color.swap',
  label: 'Swap fill/stroke',
  defaultBinding: { key: 'x' },
  gestureBinding: [
    { spec: { kind: 'key', key: 'x' }, opts: { params: { kind: 'swap' } } },
    { spec: { kind: 'key', key: 'x', mods: { shift: true } }, opts: { params: { kind: 'swapFocus' } } },
  ],
  requires: ['color'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps, params?: Record<string, unknown>) => {
      const color = (deps as ColorDeps).color;
      if (!color) return;
      if (params?.kind === 'swapFocus') color.swapFocus();
      else color.swap();
    },
  },
};

/** Toggle focused paint between its current value and `none` (/ key). */
export const colorToggleFocusedNoneAction: Action & { requires: string[] } = {
  id: 'color.toggleFocusedNone',
  label: 'Toggle focused color none',
  defaultBinding: { key: '/' },
  gestureBinding: { kind: 'key', key: '/' },
  requires: ['color'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps) => {
      (deps as ColorDeps).color?.toggleFocusedNone();
    },
  },
};

/** All three color action descriptors as a convenience array. */
export const colorActions: Action[] = [
  colorResetAction,
  colorSwapAction,
  colorToggleFocusedNoneAction,
];
