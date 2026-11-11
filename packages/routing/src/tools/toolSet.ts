/**
 * Tool sets: a named group of tool ids, the unit a consumer opts into whole.
 * A set names ids, never tools, because a tool is built by a hook that holds
 * its state; whatever mounts the set supplies the tool for each id.
 */

/** A named group of tool ids. A member is an id or another set, whose ids it takes in order. */
export interface ToolSet<TId extends string = string> {
  readonly id: string;
  readonly members: readonly (TId | ToolSet<TId>)[];
  /** Its tools share one palette button, which opens a menu of them. See {@link toolStacksOf}. */
  readonly stack?: boolean;
}

/** What a set says beside its members. */
export interface ToolSetOptions {
  /** {@link ToolSet.stack}. */
  stack?: boolean;
}

/** One entry of a list of tools to mount: an id, or a set of them. */
export type ToolEntry<TId extends string = string> = TId | ToolSet<TId>;

/** A set named `id` of `members`, in palette order. */
export function toolSet<TId extends string>(
  id: string, members: readonly ToolEntry<TId>[], options: ToolSetOptions = {},
): ToolSet<TId> {
  return options.stack ? { id, members, stack: true } : { id, members };
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

/** `set` less every id `omit` names. Keeps `set`'s id with a `-without` suffix, its `stack`, and the sets inside
 *  it, each less the same ids and dropped once empty, so a stack nested in `set` is still one. */
export function withoutTools<TId extends string>(set: ToolSet<TId>, ...omit: readonly ToolEntry<TId>[]): ToolSet<TId> {
  const gone = new Set<string>(toolIdsOf(omit));
  const cut = (inner: ToolSet<TId>): ToolSet<TId> | null => {
    const members: ToolEntry<TId>[] = [];
    for (const m of inner.members) {
      const kept = isToolSet(m) ? cut(m) : gone.has(m) ? null : m;
      if (kept !== null) members.push(kept);
    }
    if (members.length === 0) return null;
    return members.every((m, i) => m === inner.members[i]) && members.length === inner.members.length
      ? inner
      : toolSet(`${inner.id}-without`, members, { stack: inner.stack });
  };
  const kept = cut(set);
  return toolSet(`${set.id}-without`, kept?.members ?? [], { stack: set.stack });
}

/** The ids of each set `entries` hold, at any depth, that is marked `stack`, sets inside it opened: the
 *  stacks a palette showing `entries` draws. A stacked set's own nested sets are part of its stack, not
 *  stacks of their own. */
export function toolStacksOf<TId extends string>(entries: readonly ToolEntry<TId>[]): TId[][] {
  const out: TId[][] = [];
  const walk = (list: readonly ToolEntry<TId>[]): void => {
    for (const entry of list) {
      if (!isToolSet(entry)) continue;
      if (!entry.stack) walk(entry.members);
      else {
        const ids = toolIdsOf([entry]);
        if (ids.length > 0) out.push(ids);
      }
    }
  };
  walk(entries);
  return out;
}

/** Whether `set` names `id`, directly or through a set inside it. */
export function toolSetHas<TId extends string>(set: ToolSet<TId>, id: string): boolean {
  return (toolIdsOf([set]) as string[]).includes(id);
}
