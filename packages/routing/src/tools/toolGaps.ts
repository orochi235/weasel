import type { Tool } from './types';
import type { ToolDef } from './routeTypes';

/**
 * What `tool` leaves out of a complete definition, one line each, empty when nothing: a label, an icon and a palette
 * group (none for a tool kept off palettes), the export that builds it, a cursor, at least one binding, an id on every
 * binding, and an action registered for every action id a binding names. `registered` says which action ids are, over
 * the tool's own `actions`.
 */
export function toolGaps(tool: Tool, registered: (actionId: string) => boolean = () => true): string[] {
  const def = (tool.def ?? {}) as Partial<ToolDef>;
  const gaps: string[] = [];
  const p = tool.presentation;
  const own = new Set((tool.actions ?? []).map((a) => a.id));
  if (!p?.label) gaps.push('no presentation.label');
  if (!p?.hide) {
    if (!p?.icon) gaps.push('no presentation.icon');
    if (!p?.group) gaps.push('no presentation.group');
    if (def.cursor == null) gaps.push('no cursor');
  }
  if (!def.hookName) gaps.push('no hookName');
  const bindings = tool.bindings ?? [];
  if (bindings.length === 0) gaps.push('no bindings');
  for (const b of bindings) {
    if (!b.opts?.id) gaps.push(`a ${b.spec.kind} binding to ${b.actionId} has no id`);
    if (!own.has(b.actionId) && !registered(b.actionId)) gaps.push(`binding ${b.opts?.id ?? b.actionId} names unregistered action ${b.actionId}`);
  }
  return gaps;
}
