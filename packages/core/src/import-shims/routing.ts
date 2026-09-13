// `@weasel-js/core/routing` — the route *introspection* surface: the route
// grammar a route string is written in, plus the registry and conflict
// checker that walk authored routes. All of it now lives in
// `@weasel-js/routing`; this subpath stays as the name consumers import.
//
// Named rather than `export *`: esbuild cannot enumerate a star re-export
// across a package boundary and emits no binding for it.
export {
  parseRoute, formatRoute, formatPhaseAtom, collapseShiftPairs,
  describeRoute, describeRouteParts, canonicalModifiers,
  ROUTE_TERMS, ROUTE_FIELD_DEFINITIONS, RESERVED_ID_PREFIXES, RESERVED_ID_NAMES,
  getGestureDescriptor, isKnownGestureName, GESTURE_DESCRIPTORS,
} from '@weasel-js/routing';
export type {
  ParsedRoute, ParsedModifiers, ModifierKey, ModRequirement, PhaseAtom,
  ChannelRef, DescribeRouteOptions, RouteDescriptionPart, RouteTermLabel,
  RouteFieldName, GestureName, GestureDescriptor, GestureArgSpec,
} from '@weasel-js/routing';

// Reflection consumers — registry / conflict checker / debug overlay.
export {
  buildRouteRegistry, routesForSpec, routeGestureForSpecKind, PREDICATE_TARGET,
  findConflicts, reportRouteConflicts,
} from '@weasel-js/routing';
export type { RegistryEntry, Conflict } from '@weasel-js/routing';
