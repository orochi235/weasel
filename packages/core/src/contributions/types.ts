import type { RenderLayer } from 'core/layers/render';
import type { GestureBinding } from '../interactions/actions/binding';
import type { Action } from '../interactions/actions/registry';
import type { CapabilityTag } from '@weasel-js/modes';
import type { HotkeyTrigger, ToolPresentation } from '../tools/types';

/**
 * When an entry's bindings are live. A set, not one value: the hand tool is
 * palette-selectable AND engaged by holding space, and both hold at once.
 */
export interface Eligibility {
  /** Selectable as the focused entry — exclusive, one at a time. */
  focus?: boolean;
  /** Also live while this key is held. */
  offhand?: HotkeyTrigger;
  /** Live regardless of what is focused. */
  always?: boolean;
  /** Live only for input this entry's own affordances produced. */
  claimed?: boolean;
  /** Modality filter, applied wherever it would otherwise be live. */
  capabilities?: CapabilityTag[];
}

/**
 * Where an entry's overlay sits in the layer stack, relative to the
 * selection chrome. `'top'` is the default and renders above everything;
 * the other two exist for chrome that belongs under the selection handles
 * (a snap-target highlight, say). With no selection overlay in the stack,
 * all three collapse to `'top'`.
 */
export type OverlayPosition = 'top' | 'before-selection' | 'after-selection';

/**
 * A registry entry: what it contributes, and when it is eligible. Every role
 * is optional and independent — an entry that only routes input declares only
 * `bindings` and `actions`.
 */
export interface Contribution {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
  /** One layer, or several composed in the given order. */
  overlay?: RenderLayer<unknown> | RenderLayer<unknown>[];
  /** Defaults to `'top'`. Applies to every layer in `overlay`. */
  overlayPosition?: OverlayPosition;
  presentation?: ToolPresentation;
  /** Reflection escape hatch — the authored form, when there was one. */
  def?: unknown;
}
