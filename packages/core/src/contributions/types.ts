import type { RenderLayer } from 'core/layers/render';
import type { GestureBinding } from '../interactions/actions/binding';
import type { Action } from '../interactions/actions/registry';
import type { CapabilityTag } from '@weasel-js/modes';
import type { HotkeyTrigger, ToolCtx, ToolPresentation } from '../tools/types';

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
 * A registry entry: what it contributes, and when it is eligible. Every role
 * is optional and independent — an entry that only routes input declares only
 * `bindings` and `actions`.
 */
export interface Contribution {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
  overlay?: RenderLayer<unknown>;
  cursor?: string | ((ctx: ToolCtx) => string);
  presentation?: ToolPresentation;
  /** Reflection escape hatch — the authored form, when there was one. */
  def?: unknown;
}
