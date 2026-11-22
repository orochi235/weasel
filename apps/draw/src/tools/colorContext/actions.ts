/**
 * The color keys — D, X, Shift+X, and / — as actions the gesture dispatcher
 * routes. Each reads the live `color` dep, which `colorContribution`
 * publishes beside them, and paints the selection through `colorPaint` with
 * what it set, as the swatch buttons do.
 */

// Side-effect import: augments DepSchema with `color: ColorContextValue`.
import './depSchemaAugmentation';

import type { Action } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/core';
import type { ColorContextValue } from './ColorContextProvider';
import type { PaintSelection } from '../../usePaintSelection';

// ---------------------------------------------------------------------------
// Typed deps bag for color actions
// ---------------------------------------------------------------------------

interface ColorDeps extends ActionDeps {
  color?: ColorContextValue;
  colorPaint?: PaintSelection;
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

/** Reset fill to white and stroke to black (D key). */
export const colorResetAction: Action & { requires: string[] } = {
  id: 'color.reset',
  label: 'Reset colors',
  defaultBinding: [{ spec: { kind: 'key', key: 'd' }, opts: { id: 'color.reset.key' } }],
  requires: ['color', 'colorPaint'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps) => {
      const { color, colorPaint } = deps as ColorDeps;
      if (!color) return;
      const next = color.reset();
      colorPaint?.(next, 'Reset colors');
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
  defaultBinding: [
    { spec: { kind: 'key', key: 'x' }, opts: { id: 'color.swap.key', params: { kind: 'swap' } } },
    { spec: { kind: 'key', key: 'x', mods: { shift: true } }, opts: { id: 'color.swap.focus', params: { kind: 'swapFocus' } } },
  ],
  requires: ['color', 'colorPaint'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps, params?: Record<string, unknown>) => {
      const { color, colorPaint } = deps as ColorDeps;
      if (!color) return;
      if (params?.kind === 'swapFocus') color.swapFocus();
      else {
        const next = color.swap();
        colorPaint?.(next, 'Swap fill and stroke');
      }
    },
  },
};

/** Toggle focused paint between its current value and `none` (/ key). */
export const colorToggleFocusedNoneAction: Action & { requires: string[] } = {
  id: 'color.toggleFocusedNone',
  label: 'Toggle focused color none',
  defaultBinding: [{ spec: { kind: 'key', key: '/' }, opts: { id: 'color.toggleFocusedNone.key' } }],
  requires: ['color', 'colorPaint'],
  invoker: {
    timing: 'immediate',
    run: (deps: ActionDeps) => {
      const { color, colorPaint } = deps as ColorDeps;
      if (!color) return;
      const { slot, paint } = color.toggleFocusedNone();
      colorPaint?.({ [slot]: paint }, slot === 'fill' ? 'Set fill' : 'Set stroke');
    },
  },
};

/** All three color action descriptors as a convenience array. */
export const colorActions: Action[] = [
  colorResetAction,
  colorSwapAction,
  colorToggleFocusedNoneAction,
];
