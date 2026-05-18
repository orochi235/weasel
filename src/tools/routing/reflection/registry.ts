import type {
  ToolDef, PhaseDef, RouteTable, ModifierRoute, ActionFn,
  WheelTable, KeyRouteTable, MultiTouchTapTable,
} from '../types';
import type { ModifierKey } from '../modifiers';
import { getGestureDescriptor, type GestureName } from '../gestures';
import type { RoutePhase } from './route-resolved';

/** One row in the action registry — uniquely identifies a routing slot
 *  on one tool. Multiple rows can share (gesture, arg, target, modifiers)
 *  if different tools declare them; consumers walk the list and group
 *  client-side. */
export interface RegistryEntry {
  toolId: string;
  phase: RoutePhase;
  /** Canonical modifier-key string. 'default' when the route has no modifier sub-table. */
  modifiers: ModifierKey;
  gesture: GestureName;
  /** Resolved arg value for arg-bearing gestures (wheel direction,
   *  keyDown/keyUp key, multiTouchTap fingers). Undefined for gestures
   *  whose descriptor has no `arg`. */
  arg: string | undefined;
  /** Route-table key for hit-test gestures (click/dblTap/drag/contextMenu/
   *  pointerDown). Undefined when the descriptor has `hasTarget: false`. */
  target: string | undefined;
}

export function buildActionRegistry(
  tools: readonly ToolDef<unknown>[],
): RegistryEntry[] {
  const out: RegistryEntry[] = [];
  for (const tool of tools) {
    walkPhase(tool.id, 'initial', tool.initial, out);
    if (tool.engaged) walkPhase(tool.id, 'engaged', tool.engaged, out);
  }
  return out;
}

function walkPhase(
  toolId: string,
  phase: RoutePhase,
  phaseDef: PhaseDef<unknown>,
  out: RegistryEntry[],
): void {
  if (phaseDef.click)         walkRouteTable(toolId, phase, 'click',       phaseDef.click,       out);
  if (phaseDef.pointerDown)   walkRouteTable(toolId, phase, 'pointerDown', phaseDef.pointerDown, out);
  if (phaseDef.dblTap)        walkRouteTable(toolId, phase, 'dblTap',      phaseDef.dblTap,      out);
  if (phaseDef.contextMenu)   walkRouteTable(toolId, phase, 'contextMenu', phaseDef.contextMenu, out);
  if (phaseDef.drag)          walkDrag(toolId, phase, phaseDef.drag, out);
  if (phaseDef.wheel)         walkWheel(toolId, phase, phaseDef.wheel, out);
  if (phaseDef.keyDown)       walkKeyMap(toolId, phase, 'keyDown', phaseDef.keyDown, out);
  if (phaseDef.keyUp)         walkKeyMap(toolId, phase, 'keyUp',   phaseDef.keyUp,   out);
  if (phaseDef.multiTouchTap) walkMultiTouchTap(toolId, phase, phaseDef.multiTouchTap, out);
}

function walkRouteTable(
  toolId: string,
  phase: RoutePhase,
  gesture: GestureName,
  table: RouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const target of Object.keys(table)) {
    const entry = table[target];
    if (entry == null) continue;
    if (typeof entry === 'function') {
      out.push({ toolId, phase, gesture, arg: undefined, target, modifiers: 'default' });
    } else {
      walkModifierRoute(toolId, phase, gesture, target, entry, out);
    }
  }
}

function walkModifierRoute(
  toolId: string,
  phase: RoutePhase,
  gesture: GestureName,
  target: string,
  sub: ModifierRoute<unknown>,
  out: RegistryEntry[],
): void {
  for (const modKey of Object.keys(sub) as ModifierKey[]) {
    if (sub[modKey] == null) continue;
    out.push({ toolId, phase, gesture, arg: undefined, target, modifiers: modKey });
  }
}

function walkDrag(
  toolId: string,
  phase: RoutePhase,
  drag: RouteTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof drag === 'function') {
    // Function-form drag — targetless (continues from the original pointerdown).
    out.push({ toolId, phase, gesture: 'drag', arg: undefined, target: undefined, modifiers: 'default' });
  } else {
    walkRouteTable(toolId, phase, 'drag', drag, out);
  }
}

function walkWheel(
  toolId: string,
  phase: RoutePhase,
  wheel: WheelTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof wheel === 'function') {
    out.push({ toolId, phase, gesture: 'wheel', arg: 'both', target: undefined, modifiers: 'default' });
    return;
  }
  for (const dir of Object.keys(wheel) as Array<'up' | 'down' | 'both'>) {
    if (wheel[dir] == null) continue;
    out.push({ toolId, phase, gesture: 'wheel', arg: dir, target: undefined, modifiers: 'default' });
  }
}

function walkKeyMap(
  toolId: string,
  phase: RoutePhase,
  gesture: 'keyDown' | 'keyUp',
  table: KeyRouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const keyRoute of Object.keys(table)) {
    if (table[keyRoute] == null) continue;
    out.push({ toolId, phase, gesture, arg: keyRoute, target: undefined, modifiers: 'default' });
  }
}

function walkMultiTouchTap(
  toolId: string,
  phase: RoutePhase,
  table: MultiTouchTapTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const fingers of Object.keys(table) as Array<'2' | '3' | '4'>) {
    if (table[fingers] == null) continue;
    out.push({ toolId, phase, gesture: 'multiTouchTap', arg: fingers, target: undefined, modifiers: 'default' });
  }
}

// Re-export for downstream consumers.
export { getGestureDescriptor };
export type { GestureName };
