// `@weasel-js/core/routing` — the route *introspection* surface: the route
// grammar a route string is written in, plus the registry and conflict
// checker that walk authored routes.
//
// Tool authoring (`defineTool`, `defineViewportTool`, `ToolDef`) is on the
// main barrel: `import { defineTool } from '@weasel-js/core'`.
export { parseRoute, formatRoute, formatPhaseAtom, collapseShiftPairs, describeRoute, describeRouteParts, canonicalModifiers, ROUTE_TERMS, ROUTE_FIELD_DEFINITIONS, RESERVED_ID_PREFIXES, RESERVED_ID_NAMES } from './routeGrammar';
export type { ParsedRoute, ParsedModifiers, ModifierKey, ModRequirement, PhaseAtom, ChannelRef, DescribeRouteOptions, RouteDescriptionPart, RouteTermLabel, RouteFieldName } from './routeGrammar';
export { getGestureDescriptor, isKnownGestureName, GESTURE_DESCRIPTORS } from './gestures';
export type { GestureName, GestureDescriptor, GestureArgSpec } from './gestures';

// Reflection consumers — registry / conflict checker / debug overlay.
export * from './reflection';
