/** Where each cluster sits along the main chain, and the sequence a cluster's title drags it along. */
import type { Vec2 } from '@weasel-js/core';
import { maxOf, minOf, rectContainsPoint, type Rect } from '@weasel-js/geom';
import { clusterLabelIdOf } from '../dataClusters';
import { slotsAlong, type ReorderItem, type ReorderSlots } from '../reorder';
import type { ReorderSource } from './editorReorder';
import { clusterContents } from './clusterEdit';
import { mainChain } from './mainChain';
import type { EffectDoc, EffectPipeline } from './types';

/** The chain indices a cluster's stages span, both ends included. */
export interface ClusterRun {
  first: number;
  last: number;
}

/**
 * For each cluster with a stage on `chain`, counting the stages of the clusters
 * inside it, the run of chain indices those stages fill; `null` where a
 * stage outside the cluster sits between two of them.
 */
export function clusterRuns(pipeline: EffectPipeline, chain: readonly string[]): Map<string, ClusterRun | null> {
  const at = new Map(chain.map((id, i) => [id, i]));
  const doc = { pipeline, places: {} };
  const runs = new Map<string, ClusterRun | null>();
  for (const g of pipeline.clusters ?? []) {
    const on = [...clusterContents(doc, g.id).stages].flatMap((s) => at.get(s) ?? []);
    if (on.length === 0) continue;
    const first = minOf(on);
    const last = maxOf(on);
    runs.set(g.id, last - first + 1 === on.length ? { first, last } : null);
  }
  return runs;
}

/** The band across a cluster's box from its top edge to the top of its highest
 *  member: its title row, or the top padding where it has no title. */
export function clusterGripOf(doc: EffectDoc, cluster: string, boxOf: ReorderSource['boxOf']): Rect | undefined {
  const box = boxOf(cluster);
  const members = doc.pipeline.clusters?.find((g) => g.id === cluster)?.members ?? [];
  const tops = members.flatMap((m) => boxOf(m)?.y ?? []);
  if (box === undefined || tops.length === 0) return undefined;
  const height = minOf(tops) - box.y;
  return height > 0 ? { x: box.x, y: box.y, width: box.width, height } : undefined;
}

/** The stages a unit of a sequence stands for: a stage itself, or every stage inside a cluster. */
export function unitStages(doc: EffectDoc, unit: string): Set<string> {
  return doc.pipeline.clusters?.some((g) => g.id === unit) ? clusterContents(doc, unit).stages : new Set([unit]);
}

/** Each cluster member's id, mapped to the cluster that names it. */
function parentsOf(doc: EffectDoc): Map<string, string> {
  const parent = new Map<string, string>();
  for (const g of doc.pipeline.clusters ?? []) for (const m of g.members) parent.set(m, g.id);
  return parent;
}

/** The innermost cluster whose grip holds `at`, of those `among` admits. */
export function clusterAt(doc: EffectDoc, boxOf: ReorderSource['boxOf'], at: Vec2, among: (cluster: string) => boolean = () => true): string | undefined {
  const parent = parentsOf(doc);
  const depth = (id: string): number => {
    const seen = new Set<string>();
    for (let at = parent.get(id); at !== undefined && !seen.has(at); at = parent.get(at)) seen.add(at);
    return seen.size;
  };
  const held = (doc.pipeline.clusters ?? []).filter((g) => {
    const grip = among(g.id) ? clusterGripOf(doc, g.id, boxOf) : undefined;
    return grip !== undefined && rectContainsPoint(grip, at.x, at.y);
  });
  return held.sort((a, b) => depth(b.id) - depth(a.id))[0]?.id;
}

/**
 * The sequence a press at `at` drags a cluster along: the cluster {@link clusterAt}
 * picks of those whole on the main chain, among the direct members of its
 * parent, or the top level, that have stages on the drawn order. A cluster carries everything inside it and its
 * label; a stage is never picked up. `null` off every such grip.
 */
export function clusterSlotsAt(source: ReorderSource, at: Vec2): ReorderSlots | null {
  const { doc, order, boxOf } = source;
  const clusters = doc.pipeline.clusters ?? [];
  if (order === undefined || clusters.length === 0) return null;
  const parent = parentsOf(doc);
  const runs = clusterRuns(doc.pipeline, mainChain(doc.pipeline));
  const held = clusterAt(doc, boxOf, at, (g) => runs.get(g) != null);
  if (held === undefined) return null;

  const up = parent.get(held);
  const siblings = up !== undefined
    ? clusters.find((g) => g.id === up)!.members
    : [...clusters, ...doc.pipeline.stages].flatMap((u) => (parent.has(u.id) ? [] : [u.id]));
  const drawnAt = new Map(order.items.map((i, k) => [i.id, k]));
  const placed = siblings.flatMap((id) => {
    const drawn = [...unitStages(doc, id)].flatMap((s) => drawnAt.get(s) ?? []);
    const bounds = boxOf(id);
    return drawn.length === 0 || bounds === undefined ? [] : [{ id, bounds, first: minOf(drawn) }];
  }).sort((a, b) => a.first - b.first);
  const isCluster = new Set(clusters.map((g) => g.id));
  const items: ReorderItem[] = placed.map(({ id, bounds }) => {
    if (!isCluster.has(id)) return { id, bounds, grip: null };
    const inside = clusterContents(doc, id);
    const carries = [...inside.clusters, ...inside.stages, ...[...inside.clusters].map(clusterLabelIdOf)];
    return { id, bounds, grip: clusterGripOf(doc, id, boxOf) ?? null, carries };
  });
  return items.length < 2 ? null : slotsAlong(order.axis, items);
}
