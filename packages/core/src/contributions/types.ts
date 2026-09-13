import type { RenderLayer } from 'core/layers/render';
import type { GestureBinding } from '../interactions/actions/binding';
import type { Action } from '../interactions/actions/action';
import type { CapabilityTag } from '@weasel-js/modes';

/** Hotkey-slot trigger key. The slot is engaged while this key is held —
 *  hence "hotkey": active as long as the key is hot. `null` (or omitted)
 *  means the tool is not eligible for the hotkey slot. */
export type HotkeyTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift';

/** Presentation metadata for tool palettes / menus. Optional on every
 *  tool — consumers that render a palette (`<ToolPalette>`) read these
 *  fields to display the tool; consumers that don't can ignore them.
 *
 *  Note: cursor is NOT here. `Tool.cursor` (inherited from `Contribution`)
 *  is already plumbed through `<Canvas>` to `style.cursor` on the host. */
export interface ToolPresentation<TScratch = unknown> {
  /** Human-readable label, distinct from the `id`. Falls back to `id`. */
  label?: string;
  /** Inline-SVG icon component output. May be a static `ReactNode` or a
   *  function of scratch state (rare; useful for shape-aware affordances). */
  icon?: import('react').ReactNode | ((scratch?: TScratch) => import('react').ReactNode);
  /** Palette grouping key. Tools sharing a group render contiguously
   *  with separators between groups. Free-form string; the kit
   *  recommends 'select' | 'shape' | 'draw' | 'type' | 'view'. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted the palette
   *  derives one from `Tool.keybinding` via its own formatter. */
  shortcut?: string;
}

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
 * What routing reads off an entry: when its bindings are live, which they
 * are, and the actions they name.
 */
export interface ContributionRouting {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
}

/**
 * What an entry draws and how a palette shows it. None of it reaches the
 * dispatcher.
 */
export interface ContributionChrome {
  /** One layer, or several composed in the given order. */
  overlay?: RenderLayer<unknown> | RenderLayer<unknown>[];
  /** Defaults to `'top'`. Applies to every layer in `overlay`. */
  overlayPosition?: OverlayPosition;
  presentation?: ToolPresentation;
}

/**
 * A registry entry: what it contributes, and when it is eligible. Every role
 * is optional and independent — an entry that only routes input declares only
 * `bindings` and `actions`.
 */
export interface Contribution extends ContributionRouting, ContributionChrome {
  /** Reflection escape hatch — the authored form, when there was one. */
  def?: unknown;
}
