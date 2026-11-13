/**
 * The color keys — D, X, Shift+X, and / — as actions the gesture dispatcher
 * routes. Each reads the live `color` dep, which `colorContribution`
 * publishes beside them.
 */

// Side-effect import: augments DepSchema with `color: ColorContextValue`.
import './depSchemaAugmentation';

import type { Action } from '@weasel-js/core';
import type { ActionDeps } from '@weasel-js/core';
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
  defaultBinding: [{ spec: { kind: 'key', key: 'd' }, opts: { id: 'color.reset.key' } }],
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
  defaultBinding: [
    { spec: { kind: 'key', key: 'x' }, opts: { id: 'color.swap.key', params: { kind: 'swap' } } },
    { spec: { kind: 'key', key: 'x', mods: { shift: true } }, opts: { id: 'color.swap.focus', params: { kind: 'swapFocus' } } },
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
  defaultBinding: [{ spec: { kind: 'key', key: '/' }, opts: { id: 'color.toggleFocusedNone.key' } }],
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
