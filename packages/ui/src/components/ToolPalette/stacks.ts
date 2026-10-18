import type { Tool } from '@weasel-js/core';

/** One button's worth of a palette: a lone tool, or a stack of tools sharing a button. */
export type PaletteSlot =
  | { kind: 'tool'; tool: Tool }
  | { kind: 'stack'; members: Tool[] };

/**
 * Lays one group's tools out as buttons. A stack takes the place of the first of its members that
 * the palette shows, which may be in an earlier group than this one; `placed` carries the stacks
 * already laid out across groups. A stack left with one shown member is a lone tool.
 */
export function slotsOf(
  group: readonly Tool[],
  shown: ReadonlyMap<string, Tool>,
  stackOf: ReadonlyMap<string, readonly string[]>,
  placed: Set<readonly string[]>,
): PaletteSlot[] {
  const slots: PaletteSlot[] = [];
  for (const tool of group) {
    const stack = stackOf.get(tool.id);
    if (!stack) { slots.push({ kind: 'tool', tool }); continue; }
    if (placed.has(stack)) continue;
    placed.add(stack);
    const members = stack.flatMap((id) => shown.get(id) ?? []);
    slots.push(members.length === 1 ? { kind: 'tool', tool: members[0] } : { kind: 'stack', members });
  }
  return slots;
}

/** Each tool id's stack. A tool named in two stacks belongs to the first. */
export function stackIndex(stacks: ReadonlyArray<readonly string[]>): Map<string, readonly string[]> {
  const index = new Map<string, readonly string[]>();
  for (const stack of stacks) for (const id of stack) if (!index.has(id)) index.set(id, stack);
  return index;
}
