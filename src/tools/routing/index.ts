export type {
  HitResult, EmptyHit, NodeHit, AffordanceHit, NodeRef, NodeRefHit,
} from './hitResult';
export type { Result, BeginSpec } from './result';
export { apply, begin, hold, commit, cancel, claim, none } from './result';
export type { ModifierKey } from './modifiers';
export { mods } from './modifiers';
export type {
  ToolDef, PhaseDef, RouteTable, RouteEntry, ModifierRoute, ActionFn,
  ViewportToolDef, ViewportPhaseDef,
} from './types';
export { resolveRoute } from './lookup';
export { defineTool } from './defineTool';
export { defineViewportTool } from './defineViewportTool';
export { forwardActionTo } from './forwardAction';

// Reflection consumers — registry / conflict checker / debug overlay.
export * from './reflection';
