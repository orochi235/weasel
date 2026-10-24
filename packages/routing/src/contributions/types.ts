import type { GestureBinding } from '../interactions/actions/binding';
import type { Action } from '../interactions/actions/action';
import type { MenuDef } from '../menus/types';
import type { CapabilityTag } from '@weasel-js/modes';
import type { KeymapUnbound } from '../keymaps/keymapStack';
import type { DepSource } from '../interactions/actions/depNode';
import type { DepName, KernelOverlay } from '../index';

/** Hotkey-slot trigger key. The slot is engaged while this key is held —
 *  hence "hotkey": active as long as the key is hot. Omitted means the tool
 *  is not eligible for the hotkey slot.
 *
 *  The named keys map to their DOM names (`'space'` is `' '`, `'ctrl'` is
 *  `'Control'`). Anything else is a `KeyboardEvent.key` value, matched
 *  case-insensitively as every key spec is — so `'o'` holds on O. */
export type HotkeyTrigger = 'space' | 'alt' | 'ctrl' | 'meta' | 'shift' | (string & {});

/** Presentation metadata for tool palettes / menus. Optional on every
 *  tool — consumers that render a palette (`<ToolPalette>`) read these
 *  fields to display the tool; consumers that don't can ignore them.
 *
 *  Note: cursor is NOT here. `Tool.cursor` (inherited from `Contribution`)
 *  is already plumbed through `<Canvas>` to `style.cursor` on the host. */
export interface ToolPresentation {
  /** Human-readable label, distinct from the `id`. Falls back to `id`. */
  label?: string;
  /** The tool's icon, by qualified name: `icon('rect')` in the package that draws it. */
  icon?: import('@weasel-js/icons').IconRef;
  /** Palette grouping key. Tools sharing a group render contiguously
   *  with separators between groups. Free-form string; the kit
   *  recommends 'select' | 'shape' | 'draw' | 'type' | 'view'. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted the palette
   *  derives one from `Tool.keybinding` via its own formatter. */
  shortcut?: string;
  /** Keep the tool off palettes — for a tool that is only ever held, like a
   *  scrub engaged by its `hotkey`. It stays registered and selectable by
   *  id; only the palette leaves it out. */
  hide?: boolean;
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
  /** A keymap: live only while it is the innermost one open, at the hotkey
   *  tier. `unbound` overrides the `gestures.keymapUnbound` kit setting for
   *  this keymap. Open one with a leader (`keymapContribution`). */
  keymap?: true | { unbound?: KeymapUnbound };
}

/**
 * Where an entry's overlay sits in the layer stack, relative to the
 * selection chrome. `'top'` is the default and renders above everything;
 * the other two exist for chrome that belongs under the selection handles
 * (a snap-target highlight, say). With no selection overlay in the stack,
 * all three collapse to `'top'`.
 */
export type OverlayPosition = 'top' | 'before-selection' | 'after-selection';

/** Dep sources an entry provides while it is installed, by dep name. A source may read the one it displaces. */
export type ContributionDeps = { [K in DepName]?: DepSource<K> };

/**
 * What routing reads off an entry: when its bindings are live, which they
 * are, the actions they name, and the deps those actions read.
 */
export interface ContributionRouting {
  id: string;
  eligibility: Eligibility;
  bindings?: GestureBinding[];
  actions?: Action[];
  /** Menus this entry declares: always, for an ambient entry; while active, for a tool. */
  menus?: MenuDef[];
  /** Dep sources this entry provides while it is installed. A host installs
   *  them for as long as the entry is registered, whatever its eligibility. */
  deps?: ContributionDeps;
}

/**
 * What an entry draws and how a palette shows it. None of it reaches the
 * dispatcher.
 */
export interface ContributionChrome<TOverlay = KernelOverlay> {
  /** One layer, or several composed in the given order.
   *
   *  Routing never reads a layer — it collects the live ones and hands them
   *  back in scope order. `TOverlay` is what the consuming kernel draws;
   *  `@weasel-js/core` binds it to `RenderLayer<unknown>`. */
  overlay?: TOverlay | TOverlay[];
  /** Defaults to `'top'`. Applies to every layer in `overlay`. */
  overlayPosition?: OverlayPosition;
  presentation?: ToolPresentation;
}

/**
 * A registry entry: what it contributes, and when it is eligible. Every role
 * is optional and independent — an entry that only routes input declares only
 * `bindings` and `actions`.
 */
export interface Contribution<TOverlay = KernelOverlay>
  extends ContributionRouting, ContributionChrome<TOverlay> {
  /** Reflection escape hatch — the authored form, when there was one. */
  def?: unknown;
}
