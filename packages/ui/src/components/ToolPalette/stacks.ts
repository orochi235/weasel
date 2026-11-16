import type { Tool } from '@weasel-js/routing';
import { isDev } from '@weasel-js/registry';

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

/** Each tool id's stack. Throws for a tool named in two stacks. */
export function stackIndex(stacks: ReadonlyArray<readonly string[]>): Map<string, readonly string[]> {
  const index = new Map<string, readonly string[]>();
  for (const stack of stacks) {
    for (const id of stack) {
      const held = index.get(id);
      if (held !== undefined && held !== stack) {
        throw new Error(`weasel: ToolPalette stacks name the tool "${id}" in two stacks, ${JSON.stringify(held)} and ${JSON.stringify(stack)}. Name each tool in one stack.`);
      }
      index.set(id, stack);
    }
  }
  return index;
}

const warnedStacks = new Set<string>();

/** Warn once per id, in dev, of a stacked id that names no tool in `registry`. */
export function warnStacks(stacks: ReadonlyArray<readonly string[]>, registry: Readonly<Record<string, Tool>>): void {
  if (!isDev()) return;
  for (const id of stacks.flat()) {
    if (Object.hasOwn(registry, id) || warnedStacks.has(id)) continue;
    warnedStacks.add(id);
    console.warn(`weasel: ToolPalette stacks name "${id}", which no registered tool has as its id, so it is left out. Check the id for a typo.`);
  }
}
