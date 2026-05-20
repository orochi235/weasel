// Barrel for @orochi235/weasel-gestures.
//
// Source is split into two subtrees:
//   - `grammar/` — abstract logic (taxonomy, modifiers, route grammars,
//     modifier-key reflection). No event/UI types.
//   - `ui/`      — UI-flavored types: GestureSpec union, normalized
//     InputEvent, the pure matcher, RoutePhase.

// ─── grammar ──────────────────────────────────────────────────────────────

// Gesture taxonomy
export {
  GESTURE_DESCRIPTORS,
  getGestureDescriptor,
  isKnownGestureName,
} from './grammar/gestures';
export type {
  GestureName,
  GestureDescriptor,
  GestureArgSpec,
} from './grammar/gestures';

// Modifier helpers
export { mods } from './grammar/modifiers';
export type { ModifierKey } from './grammar/modifiers';

// Route grammar (v3)
export {
  parseRoute,
  formatRoute,
  formatPhaseAtom,
  RESERVED_SIGILS,
  ACTIVE_SIGILS,
  RESERVED_ID_PREFIXES,
  RESERVED_ID_NAMES,
  VALID_MOD_NAMES,
  MOD_NAME_SET,
} from './grammar/routeGrammar';
export type {
  ParsedRoute,
  ParsedModifiers,
  ModName,
  ModRequirement,
  PhaseAtom,
  ChannelRef,
} from './grammar/routeGrammar';

// Key-route grammar
export { parseKeyRoute, formatKeyRoute, keyRouteToSpec } from './grammar/keyRouteGrammar';
export type { ParsedKeyRoute, OptionalMod } from './grammar/keyRouteGrammar';

// Modifier-key reflection helpers
export { modifierKeyToParsed, canonicalModifiers } from './grammar/modifierKeyToParsed';

// ─── ui ───────────────────────────────────────────────────────────────────

// Phase + InputEvent
export type { RoutePhase } from './ui/phase';
export type { InputEvent } from './ui/inputEvent';

// GestureSpec union + sub-types + ModSpec + TargetSpec
export type {
  GestureSpec,
  KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DragSpec,
  MultiTouchSpec, ContextMenuSpec, MultiTouchTapSpec,
  ModSpec, TargetSpec,
} from './ui/spec';

// Pure matcher functions
export { matchSpec, matchModifiers, matchKey, matchTarget } from './ui/match';
