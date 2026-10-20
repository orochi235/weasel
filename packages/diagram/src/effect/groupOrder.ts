/** Where each group sits along the main chain, and the sequence a group's title drags it along. */
import type { Vec2 } from '@weasel-js/core';
import { groupLabelIdOf } from '../dataGroups';
import { sequenceSlots, type ReorderItem, type ReorderSlots } from '../reorder';
import type { ReorderSource } from './editorReorder';
import { groupContents } from './groupEdit';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectPipeline } from './types';

/** The chain indices a group's stages span, both ends included. */
export interface GroupRun {
  first: number;
  last: number;
}

/**
 * For each group with a stage on `chain`, counting the stages of the groups
 * inside it, the run of chain indices those stages fill; `null` where a
 * stage outside the group sits between two of them.
 */
export function groupRuns(pipeline: EffectPipeline, chain: readonly string[]): Map<string, GroupRun | null> {
  const at = new Map(chain.map((id, i) => [id, i]));
  const doc = { pipeline, places: {} };
  const runs = new Map<string, GroupRun | null>();
  for (const g of pipeline.groups ?? []) {
    const on = [...groupContents(doc, g.id).stages].flatMap((s) => at.get(s) ?? []);
    if (on.length === 0) continue;
    const first = Math.min(...on);
    const last = Math.max(...on);
    runs.set(g.id, last - first + 1 === on.length ? { first, last } : null);
  }
  return runs;
}

type Box = { x: number; y: number; width: number; height: number };

const holds = (b: Box, p: Vec2) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/** The band across a group's box from its top edge to the top of its highest
 *  member: its title row, or the top padding where it has no title. */
export function groupGripOf(doc: EffectDoc, group: string, boxOf: ReorderSource['boxOf']): Box | undefined {
  const box = boxOf(group);
  const members = doc.pipeline.groups?.find((g) => g.id === group)?.members ?? [];
  const tops = members.flatMap((m) => boxOf(m)?.y ?? []);
  if (box === undefined || tops.length === 0) return undefined;
  const height = Math.min(...tops) - box.y;
  return height > 0 ? { x: box.x, y: box.y, width: box.width, height } : undefined;
}

/** The stages a unit of a sequence stands for: a stage itself, or every stage inside a group. */
export function unitStages(doc: EffectDoc, unit: string): Set<string> {
  return doc.pipeline.groups?.some((g) => g.id === unit) ? groupContents(doc, unit).stages : new Set([unit]);
}

/** The innermost group whose grip holds `at`, of those `among` admits. */
export function groupAt(doc: EffectDoc, boxOf: ReorderSource['boxOf'], at: Vec2, among: (group: string) => boolean = () => true): string | undefined {
  const parent = new Map<string, string>();
  for (const g of doc.pipeline.groups ?? []) for (const m of g.members) parent.set(m, g.id);
  const depth = (id: string): number => (parent.has(id) ? 1 + depth(parent.get(id)!) : 0);
  const held = (doc.pipeline.groups ?? []).filter((g) => {
    const grip = among(g.id) ? groupGripOf(doc, g.id, boxOf) : undefined;
    return grip !== undefined && holds(grip, at);
  });
  return held.sort((a, b) => depth(b.id) - depth(a.id))[0]?.id;
}

/**
 * The sequence a press at `at` drags a group along: the group {@link groupAt}
 * picks of those whole on the main chain, among the direct members of its
 * parent, or the top level, that have stages on the drawn order. A group carries everything inside it and its
 * label; a stage is never picked up. `null` off every such grip.
 */
export function groupSlotsAt(source: ReorderSource, at: Vec2): ReorderSlots | null {
  const { doc, order, boxOf } = source;
  const groups = doc.pipeline.groups ?? [];
  if (order === undefined || groups.length === 0) return null;
  const parent = new Map<string, string>();
  for (const g of groups) for (const m of g.members) parent.set(m, g.id);
  const runs = groupRuns(doc.pipeline, mainChain(doc.pipeline));
  const held = groupAt(doc, boxOf, at, (g) => runs.get(g) != null);
  if (held === undefined) return null;

  const up = parent.get(held);
  const siblings = up !== undefined
    ? groups.find((g) => g.id === up)!.members
    : [...groups, ...doc.pipeline.stages].flatMap((u) => (parent.has(u.id) ? [] : [u.id]));
  const drawnAt = new Map(order.items.map((i, k) => [i.id, k]));
  const placed = siblings.flatMap((id) => {
    const drawn = [...unitStages(doc, id)].flatMap((s) => drawnAt.get(s) ?? []);
    const bounds = boxOf(id);
    return drawn.length === 0 || bounds === undefined ? [] : [{ id, bounds, first: Math.min(...drawn) }];
  }).sort((a, b) => a.first - b.first);
  const isGroup = new Set(groups.map((g) => g.id));
  const items: ReorderItem[] = placed.map(({ id, bounds }) => {
    if (!isGroup.has(id)) return { id, bounds, grip: null };
    const inside = groupContents(doc, id);
    const carries = [...inside.groups, ...inside.stages, ...[...inside.groups].map(groupLabelIdOf)];
    return { id, bounds, grip: groupGripOf(doc, id, boxOf) ?? null, carries };
  });
  return items.length < 2 ? null : sequenceSlots(order.axis, items);
}
