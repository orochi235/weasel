// Barrel for @weasel-js/gestures.
//
// Source is split into three subtrees:
//   - `grammar/`    — abstract logic (taxonomy, modifiers, route grammars,
//     modifier-key reflection). No event/UI types.
//   - `ui/`         — UI-flavored types: GestureSpec union, normalized
//     InputEvent, the pure matcher, RoutePhase.
//   - `recognizer/` — raw pointer input turned into the gestures above.

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
  ClaimableGesture,
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

// Route → GestureSpec
export { routeToSpec } from './grammar/routeToSpec';
export { routeGestureForSpecKind, specKindForRouteGesture } from './grammar/specKinds';

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
  BodyKind,
  BodyClassification,
  DoubleClickBody,
  IngestItem,
  KeyEvent,
  KeyHeldEvent,
  WheelEvent,
  PinchEvent,
  PointerSampleStylus,
  PointerIdentity,
  PointerDownEvent,
  PointerMoveEvent,
  HoverEvent, HoverWhere,
  PointerUpEvent,
  PointerCancelEvent,
  ClickEvent,
  DoubleClickEvent,
  ContextMenuEvent,
  LongPressEvent,
  MultiTouchEvent,
  MultiTouchTapEvent,
  DropEvent,
  CarryEvent,
  PasteEvent,
} from './ui/inputEvent';
export { stylusOf } from './ui/stylus';

// GestureSpec union + sub-types + ModSpec + TargetSpec + PhaseSpec
export type {
  GestureSpec,
  KeySpec, KeyHeldSpec, WheelSpec, PinchSpec, ClickSpec, DoubleClickSpec, DragSpec,
  PointerDownSpec, HoverSpec, LongPressSpec,
  MultiTouchSpec, ContextMenuSpec, MultiTouchTapSpec,
  DropSpec, CarrySpec, PasteSpec,
  ModSpec, TargetSpec, TargetPredicate, PhaseSpec,
} from './ui/spec';
export { hitPredicate, bodyPredicate } from './ui/spec';

// Pure matcher functions
export { matchSpec, matchModifiers, matchKey, matchTarget, matchPhase, parseTargetSpec } from './ui/match';
export { mimeMatchesGlob, matchIngestTypes, UNKNOWN_MIME } from './ui/ingestTypes';
export type { PhaseContext, ModifiersEvent, TargetSpecForm } from './ui/match';
export { isApplePlatform } from './ui/platform';

// Shortcut legends: how a keyboard prints a binding's keys, per platform
export { keySpecsFromMods, keySpecFromKey, detectPlatform, MODIFIER_LABELS } from './ui/keySpecsFromMods';
export type {
  KeyLegend, LogicalMod, LogicalModSpec, Platform, LegendStyle, KeySpecsFromModsOptions, KeyLabels,
} from './ui/keySpecsFromMods';
export { keySpecsFromShortcut } from './ui/keySpecsFromShortcut';
export { keySpecFromCode } from './ui/keySpecFromCode';
export { formatShortcut, formatShortcutParts, SHORTCUT_LEADER_SEPARATOR } from './ui/formatShortcut';
export { bindingSpec, held, key, keySpecRoute, unbound } from './ui/keySugar';
export type { BindingOverrideInput } from './ui/keySugar';
export type { ShortcutInput, FormatShortcutOptions, ShortcutLeaderStep, ShortcutParts } from './ui/formatShortcut';
export { fixedSeat, nearestPortalHost } from './ui/fixedSeat';
export type { FixedSeat } from './ui/fixedSeat';

// Binding precedence
export { specificity } from './ui/specificity';

// Click-vs-drag travel
export { DRAG_THRESHOLD_PX, pastDragThreshold } from './ui/dragThreshold';
export {
  DOUBLE_CLICK_MAX_MS, DOUBLE_CLICK_MAX_PX, LONG_PRESS_MS, TAP_THRESHOLD_PX,
} from './recognizer/thresholds';

// ─── recognizer ───────────────────────────────────────────────────────────

// Pointer samples in, InputEvents out. No DOM: the host supplies the clock.
export { createPointerRecognizer } from './recognizer/pointerRecognizer';
export type {
  PointerRecognizer, PointerRecognizerOptions, RecognizerObserver, RecognizerSink,
} from './recognizer/pointerRecognizer';
export type { PointerSample, PressSample } from './recognizer/samples';
export type { HeldPress, RecognizerClock } from './recognizer/longPressHold';
export type { ClickMemory, ClickObserver, ReleaseOutcome } from './recognizer/click';
export { multiTouchGeometry, type MultiTouchGeometry, type Point } from './recognizer/multiTouch';
export { clickEvents, longPressEvents } from './recognizer/pressFacts';
export type { PressFacts, ReleaseFacts } from './recognizer/pressFacts';
export { CONTROL_SELECTOR, isInControlWithin } from './ui/controlTarget';
export { heldPointers, type HeldPointers } from './ui/heldPointers';
export { activatesFocusedControl, focusedControlOwnsKey, isEditableTarget } from './ui/keyOwner';
