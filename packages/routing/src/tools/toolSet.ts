/**
 * Tool sets: a named group of tool ids, the unit a consumer opts into whole.
 * A set names ids, never tools, because a tool is built by a hook that holds
 * its state; whatever mounts the set supplies the tool for each id.
 */

/** A named group of tool ids. A member is an id or another set, whose ids it takes in order. */
export interface ToolSet<TId extends string = string> {
  readonly id: string;
  readonly members: readonly (TId | ToolSet<TId>)[];
}

/** One entry of a list of tools to mount: an id, or a set of them. */
export type ToolEntry<TId extends string = string> = TId | ToolSet<TId>;

/** A set named `id` of `members`, in palette order. */
export function toolSet<TId extends string>(id: string, members: readonly ToolEntry<TId>[]): ToolSet<TId> {
  return { id, members };
}

/** Whether `entry` is a set rather than a single id. */
export function isToolSet<TId extends string>(entry: ToolEntry<TId>): entry is ToolSet<TId> {
  return typeof entry !== 'string';
}

/** Every id `entries` name, sets opened in place, each id once at its first place. */
export function toolIdsOf<TId extends string>(entries: readonly ToolEntry<TId>[]): TId[] {
  const out: TId[] = [];
  const seen = new Set<string>();
  const walk = (list: readonly ToolEntry<TId>[]): void => {
    for (const entry of list) {
      if (isToolSet(entry)) walk(entry.members);
      else if (!seen.has(entry)) {
        seen.add(entry);
        out.push(entry);
      }
    }
  };
  walk(entries);
  return out;
}

/** `set` less every id `omit` names, sets opened. Keeps `set`'s id with a `-without` suffix. */
export function withoutTools<TId extends string>(set: ToolSet<TId>, ...omit: readonly ToolEntry<TId>[]): ToolSet<TId> {
  const gone = new Set<string>(toolIdsOf(omit));
  return { id: `${set.id}-without`, members: toolIdsOf([set]).filter((id) => !gone.has(id)) };
}

/** Whether `set` names `id`, directly or through a set inside it. */
export function toolSetHas<TId extends string>(set: ToolSet<TId>, id: string): boolean {
  return (toolIdsOf([set]) as string[]).includes(id);
}
