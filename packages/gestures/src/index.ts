// Barrel for @weasel-js/gestures.
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
export type { ModifierCombo } from './grammar/modifiers';

// Route grammar (v3)
export {
  parseRoute,
  formatRoute,
  formatPhaseAtom,
  collapseShiftPairs,
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
  ModifierKey,
  ModRequirement,
  PhaseAtom,
  ChannelRef,
} from './grammar/routeGrammar';

// Key-route grammar
export { parseKeyRoute, formatKeyRoute, keyRouteToSpec } from './grammar/keyRouteGrammar';
export type { ParsedKeyRoute, OptionalMod } from './grammar/keyRouteGrammar';

// Plain-English route descriptions
export { describeRoute, describeRouteParts, ROUTE_TERMS, ROUTE_FIELD_DEFINITIONS } from './grammar/describeRoute';
export type { DescribeRouteOptions, RouteDescriptionPart, RouteTermLabel, RouteFieldName } from './grammar/describeRoute';

// Modifier-key reflection helpers
export { modifierComboToParsed, canonicalModifiers } from './grammar/modifierComboToParsed';

// ─── ui ───────────────────────────────────────────────────────────────────

// Phase + InputEvent
export type { RoutePhase } from './ui/phase';
export type {
  InputEvent,
  EventModifiers,
  BodyTarget,
  IngestItem,
  KeyEvent,
  KeyHeldEvent,
  WheelEvent,
  PointerDownEvent,
  PointerMoveEvent,
  PointerUpEvent,
  PointerCancelEvent,
  ClickEvent,
  DoubleClickEvent,
  ContextMenuEvent,
  MultitouchEvent,
  MultitouchTapEvent,
  DropEvent,
  PasteEvent,
} from './ui/inputEvent';

// GestureSpec union + sub-types + ModSpec + TargetSpec + PhaseSpec
export type {
  GestureSpec,
  KeySpec, KeyHeldSpec, WheelSpec, ClickSpec, DoubleClickSpec, DragSpec,
  MultiTouchSpec, ContextMenuSpec, MultiTouchTapSpec,
  DropSpec, PasteSpec,
  ModSpec, TargetSpec, PhaseSpec,
} from './ui/spec';

// Pure matcher functions
export { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase, mimeMatchesGlob, matchIngestTypes } from './ui/match';
export type { PhaseContext, ModifiersEvent } from './ui/match';
