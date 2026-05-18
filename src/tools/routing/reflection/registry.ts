import type {
  ToolDef, PhaseDef, RouteTable, ModifierRoute, ActionFn,
} from '../types';
import type { ModifierKey } from '../modifiers';
import type { RoutePhase, RouteGesture } from './route-resolved';

/** One row in the action registry — uniquely identifies a routing slot
 *  on one tool. Multiple rows can share (target, modifiers, gesture) if
 *  different tools both declare them; consumers walk the list and group
 *  client-side. */
export interface RegistryEntry {
  toolId: string;
  phase: RoutePhase;
  /** Canonical 8-key string from mods(). 'default' when the route has no
   *  modifier sub-table. */
  modifiers: ModifierKey;
  gesture: RouteGesture;
  /** Route-table key the entry was registered under. For click/dblTap/drag
   *  route tables, this is the target kind. For wheel and function-form
   *  drag, this is '*' (no target dimension). For keyDown/keyUp, this is
   *  the key name (e.g., 'Escape', 'Enter'). */
  target: string;
}

/** Walk a list of ToolDefs and produce a flat registry of every routed
 *  action they expose. The result is a static snapshot — call again if
 *  tools register or unregister. */
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
  if (phaseDef.click)  walkRouteTable(toolId, phase, 'click',  phaseDef.click,  out);
  if (phaseDef.dblTap) walkRouteTable(toolId, phase, 'dblTap', phaseDef.dblTap, out);
  if (phaseDef.drag)   walkDrag(toolId, phase, phaseDef.drag, out);
  if (phaseDef.wheel)  out.push({ toolId, phase, gesture: 'wheel', target: '*', modifiers: 'default' });
  if (phaseDef.keyDown) walkKeyMap(toolId, phase, 'keyDown', phaseDef.keyDown, out);
  if (phaseDef.keyUp)   walkKeyMap(toolId, phase, 'keyUp',   phaseDef.keyUp,   out);
}

function walkRouteTable(
  toolId: string,
  phase: RoutePhase,
  gesture: RouteGesture,
  table: RouteTable<unknown>,
  out: RegistryEntry[],
): void {
  for (const target of Object.keys(table)) {
    const entry = table[target];
    if (entry == null) continue;
    if (typeof entry === 'function') {
      out.push({ toolId, phase, gesture, target, modifiers: 'default' });
    } else {
      walkModifierRoute(toolId, phase, gesture, target, entry, out);
    }
  }
}

function walkModifierRoute(
  toolId: string,
  phase: RoutePhase,
  gesture: RouteGesture,
  target: string,
  sub: ModifierRoute<unknown>,
  out: RegistryEntry[],
): void {
  for (const modKey of Object.keys(sub) as ModifierKey[]) {
    if (sub[modKey] == null) continue;
    out.push({ toolId, phase, gesture, target, modifiers: modKey });
  }
}

function walkDrag(
  toolId: string,
  phase: RoutePhase,
  drag: RouteTable<unknown> | ActionFn<unknown>,
  out: RegistryEntry[],
): void {
  if (typeof drag === 'function') {
    // Function-form drag — uniform across targets, no modifier dimension.
    out.push({ toolId, phase, gesture: 'drag', target: '*', modifiers: 'default' });
  } else {
    walkRouteTable(toolId, phase, 'drag', drag, out);
  }
}

function walkKeyMap(
  toolId: string,
  phase: RoutePhase,
  gesture: 'keyDown' | 'keyUp',
  table: Partial<Record<string, ActionFn<unknown>>>,
  out: RegistryEntry[],
): void {
  for (const key of Object.keys(table)) {
    out.push({ toolId, phase, gesture, target: key, modifiers: 'default' });
  }
}
