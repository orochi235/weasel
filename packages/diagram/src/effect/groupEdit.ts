/** Edits to a pipeline's groups: what each holds, its label, and its box under `nodeGraph`. */
import type { Vec2 } from '@weasel-js/core/math';
import type { EffectBox, EffectDoc, EffectGroup, EffectPipeline } from './types';

const groupsOf = (doc: EffectDoc): readonly EffectGroup[] => doc.pipeline.groups ?? [];

/** `doc` with `groups`, and only the boxes of groups still in it. */
function withGroups(doc: EffectDoc, groups: readonly EffectGroup[], boxes = doc.groupBoxes): EffectDoc {
  const ids = new Set(groups.map((g) => g.id));
  const kept = Object.entries(boxes ?? {}).filter(([id]) => ids.has(id));
  const { groupBoxes: _was, ...rest } = doc;
  return { ...rest, pipeline: { ...doc.pipeline, groups }, ...(kept.length > 0 ? { groupBoxes: Object.fromEntries(kept) } : {}) };
}

/**
 * `groups` without the `gone` members, and without any group they leave
 * empty, unless `keep` says to keep it. A group empty to begin with stays.
 */
export function pruneGroups(
  groups: readonly EffectGroup[], gone: ReadonlySet<string>, keep: (id: string) => boolean = () => false,
): EffectGroup[] {
  const out = new Set(gone);
  let left = [...groups];
  for (;;) {
    const emptied = left.filter((g) => g.members.length > 0 && g.members.every((m) => out.has(m)) && !keep(g.id));
    if (emptied.length === 0) return left.map((g) => ({ ...g, members: g.members.filter((m) => !out.has(m)) }));
    for (const g of emptied) out.add(g.id);
    left = left.filter((g) => !emptied.includes(g));
  }
}

/** The group holding `id` directly, if any. */
const parentOf = (groups: readonly EffectGroup[], id: string) => groups.find((g) => g.members.includes(id));

/** `group` if no stage or group has it, else `group-2`, `group-3`, … */
export function nextGroupId(p: EffectPipeline): string {
  const used = new Set([...p.stages.map((s) => s.id), ...(p.groups ?? []).map((g) => g.id)]);
  if (!used.has('group')) return 'group';
  let n = 2;
  while (used.has(`group-${n}`)) n++;
  return `group-${n}`;
}

/**
 * Groups `ids`, stages or groups, in a new group whose id is
 * {@link nextGroupId}'s. It nests inside the group all of them share, where
 * the first of them was; otherwise it goes at the top level, taking them out
 * of the groups they were in.
 */
export function groupStages(doc: EffectDoc, ids: readonly string[], label?: string): EffectDoc {
  if (ids.length === 0) return doc;
  const id = nextGroupId(doc.pipeline);
  const groups = groupsOf(doc);
  const parents = new Set(ids.map((m) => parentOf(groups, m)?.id));
  const shared = parents.size === 1 ? [...parents][0] : undefined;
  const taken = new Set(ids);
  const made: EffectGroup = { id, ...(label ? { label } : {}), members: [...ids] };
  const rest = shared === undefined ? pruneGroups(groups, taken) : groups.map((g) => {
    if (g.id !== shared) return g;
    const at = g.members.findIndex((m) => taken.has(m));
    const members = g.members.filter((m) => !taken.has(m));
    members.splice(at, 0, id);
    return { ...g, members };
  });
  return withGroups(doc, [...rest, made]);
}

/** Dissolves group `id`: its members go to its parent group, in its place, or to the top level. */
export function ungroup(doc: EffectDoc, id: string): EffectDoc {
  const groups = groupsOf(doc);
  const gone = groups.find((g) => g.id === id);
  if (gone === undefined) return doc;
  const kept = groups.filter((g) => g.id !== id).map((g) => (g.members.includes(id)
    ? { ...g, members: g.members.flatMap((m) => (m === id ? gone.members : [m])) }
    : g));
  return withGroups(doc, kept);
}

/** Sets group `id`'s label; an empty one removes it. */
export function renameGroup(doc: EffectDoc, id: string, label: string): EffectDoc {
  return withGroups(doc, groupsOf(doc).map((g) => {
    if (g.id !== id) return g;
    const { label: _was, ...rest } = g;
    return label === '' ? rest : { ...rest, label };
  }));
}

/** Whether `inner` is `outer` or inside it. */
function within(groups: readonly EffectGroup[], inner: string, outer: string): boolean {
  for (let at: string | undefined = inner; at !== undefined; at = parentOf(groups, at)?.id) if (at === outer) return true;
  return false;
}

/**
 * Moves `ids`, stages or groups, into group `group`, or to the top level for
 * `null`, out of the groups they were in. A group left empty goes too unless
 * it has a box. `doc` itself when `group` is unknown or inside one of `ids`.
 */
export function moveToGroup(doc: EffectDoc, ids: readonly string[], group: string | null): EffectDoc {
  const groups = groupsOf(doc);
  if (group !== null && (!groups.some((g) => g.id === group) || ids.some((id) => within(groups, group, id)))) return doc;
  const moving = new Set(ids);
  const boxed = (id: string) => id === group || doc.groupBoxes?.[id] !== undefined;
  const left = pruneGroups(groups, moving, boxed);
  const placed = group === null ? left : left.map((g) => (g.id === group ? { ...g, members: [...g.members, ...ids] } : g));
  return withGroups(doc, placed);
}

/** Sets group `id`'s box under `nodeGraph`; `null` has it fit its members again. */
export function setGroupBox(doc: EffectDoc, id: string, box: EffectBox | null): EffectDoc {
  const { [id]: _was, ...rest } = doc.groupBoxes ?? {};
  return withGroups(doc, groupsOf(doc), box === null ? rest : { ...rest, [id]: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

/** Group `id` and every stage and group inside it. */
export function groupContents(doc: EffectDoc, id: string): { stages: Set<string>; groups: Set<string> } {
  const groups = new Map(groupsOf(doc).map((g) => [g.id, g]));
  const out = { stages: new Set<string>(), groups: new Set<string>() };
  const visit = (g: string) => {
    if (out.groups.has(g)) return;
    out.groups.add(g);
    for (const m of groups.get(g)?.members ?? []) {
      if (groups.has(m)) visit(m);
      else out.stages.add(m);
    }
  };
  if (groups.has(id)) visit(id);
  return out;
}

/**
 * Moves group `id` by `offset`: the places of the stages inside it, its box
 * and the boxes inside it, and the routes of wires with both ends inside it.
 * A stage with no place stays where layout puts it.
 */
export function moveGroup(doc: EffectDoc, id: string, offset: Vec2): EffectDoc {
  const { stages, groups } = groupContents(doc, id);
  const by = (p: Vec2) => ({ x: p.x + offset.x, y: p.y + offset.y });
  const places = Object.fromEntries(Object.entries(doc.places).map(([s, p]) => [s, stages.has(s) ? by(p) : p]));
  const inside = new Set(doc.pipeline.wires.flatMap((w) => (w.id !== undefined && stages.has(w.from.stage) && stages.has(w.to.stage) ? [w.id] : [])));
  const routes = doc.routes === undefined ? undefined
    : Object.fromEntries(Object.entries(doc.routes).map(([w, r]) => [w, inside.has(w) ? r.map(by) : r]));
  const boxes = doc.groupBoxes === undefined ? undefined
    : Object.fromEntries(Object.entries(doc.groupBoxes).map(([g, b]) => [g, groups.has(g) ? { ...b, ...by(b) } : b]));
  return {
    ...doc, places,
    ...(routes !== undefined ? { routes } : {}),
    ...(boxes !== undefined ? { groupBoxes: boxes } : {}),
  };
}
