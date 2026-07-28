export type { ToolDef, ViewportToolDef, ToolKeybinding } from './types';
export { parseRoute, formatRoute, formatPhaseAtom, collapseShiftPairs, describeRoute, describeRouteParts, canonicalModifiers, ROUTE_TERMS, ROUTE_FIELD_DEFINITIONS, RESERVED_ID_PREFIXES, RESERVED_ID_NAMES } from './routeGrammar';
export type { ParsedRoute, ParsedModifiers, ModifierKey, ModRequirement, PhaseAtom, ChannelRef, DescribeRouteOptions, RouteDescriptionPart, RouteTermLabel, RouteFieldName } from './routeGrammar';
export { getGestureDescriptor, isKnownGestureName, GESTURE_DESCRIPTORS } from './gestures';
export type { GestureName, GestureDescriptor, GestureArgSpec } from './gestures';
export { defineTool } from './defineTool';
export { defineViewportTool } from './defineViewportTool';

// Reflection consumers — registry / conflict checker / debug overlay.
export * from './reflection';
