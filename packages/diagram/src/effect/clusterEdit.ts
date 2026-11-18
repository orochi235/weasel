/** Edits to a pipeline's clusters: what each holds, its label, and its box under `nodeGraph`. */
import type { Vec2 } from '@weasel-js/core/math';
import { freshId, getOwn } from '@weasel-js/registry';
import type { EffectBox, EffectDoc, EffectCluster, EffectPipeline } from './types';

const clustersOf = (doc: EffectDoc): readonly EffectCluster[] => doc.pipeline.clusters ?? [];

/** `doc` with `clusters`, and only the boxes of clusters still in it. */
function withClusters(doc: EffectDoc, clusters: readonly EffectCluster[], boxes = doc.clusterBoxes): EffectDoc {
  const ids = new Set(clusters.map((g) => g.id));
  const kept = Object.entries(boxes ?? {}).filter(([id]) => ids.has(id));
  const { clusterBoxes: _was, ...rest } = doc;
  return { ...rest, pipeline: { ...doc.pipeline, clusters }, ...(kept.length > 0 ? { clusterBoxes: Object.fromEntries(kept) } : {}) };
}

/**
 * `clusters` without the `gone` members, and without any cluster they leave
 * empty, unless `keep` says to keep it. A cluster empty to begin with stays.
 */
export function pruneClusters(
  clusters: readonly EffectCluster[], gone: ReadonlySet<string>, keep: (id: string) => boolean = () => false,
): EffectCluster[] {
  const out = new Set(gone);
  let left = [...clusters];
  for (;;) {
    const emptied = left.filter((g) => g.members.length > 0 && g.members.every((m) => out.has(m)) && !keep(g.id));
    if (emptied.length === 0) return left.map((g) => ({ ...g, members: g.members.filter((m) => !out.has(m)) }));
    for (const g of emptied) out.add(g.id);
    left = left.filter((g) => !emptied.includes(g));
  }
}

/** The cluster holding `id` directly, if any. */
const parentOf = (clusters: readonly EffectCluster[], id: string) => clusters.find((g) => g.members.includes(id));

/** `ids` without repeats, and without any inside another of them, which carries it. */
const outermost = (clusters: readonly EffectCluster[], ids: readonly string[]): string[] =>
  [...new Set(ids)].filter((id, _i, all) => !all.some((o) => o !== id && within(clusters, id, o)));

/** `cluster` if no stage or cluster has it, else `cluster-2`, `cluster-3`, … */
export function nextClusterId(p: EffectPipeline): string {
  const used = new Set([...p.stages.map((s) => s.id), ...(p.clusters ?? []).map((g) => g.id)]);
  return freshId('cluster', used, { bare: true, from: 2 });
}

/**
 * Puts `ids`, stages or clusters, in a new cluster whose id is
 * {@link nextClusterId}'s. It nests inside the cluster all of them share, where
 * the first of them was; otherwise it goes at the top level, taking them out
 * of the clusters they were in. One of `ids` inside another goes with it.
 */
export function clusterStages(doc: EffectDoc, given: readonly string[], label?: string): EffectDoc {
  if (given.length === 0) return doc;
  const id = nextClusterId(doc.pipeline);
  const clusters = clustersOf(doc);
  const ids = outermost(clusters, given);
  if (ids.length === 0) return doc;
  const parents = new Set(ids.map((m) => parentOf(clusters, m)?.id));
  const shared = parents.size === 1 ? [...parents][0] : undefined;
  const taken = new Set(ids);
  const made: EffectCluster = { id, ...(label ? { label } : {}), members: [...ids] };
  const rest = shared === undefined ? pruneClusters(clusters, taken) : clusters.map((g) => {
    if (g.id !== shared) return g;
    const at = g.members.findIndex((m) => taken.has(m));
    const members = g.members.filter((m) => !taken.has(m));
    members.splice(at, 0, id);
    return { ...g, members };
  });
  return withClusters(doc, [...rest, made]);
}

/** Dissolves cluster `id`: its members go to its parent cluster, in its place, or to the top level. */
export function dissolveCluster(doc: EffectDoc, id: string): EffectDoc {
  const clusters = clustersOf(doc);
  const gone = clusters.find((g) => g.id === id);
  if (gone === undefined) return doc;
  const kept = clusters.filter((g) => g.id !== id).map((g) => (g.members.includes(id)
    ? { ...g, members: g.members.flatMap((m) => (m === id ? gone.members : [m])) }
    : g));
  return withClusters(doc, kept);
}

/** Sets cluster `id`'s label; an empty one removes it. */
export function renameCluster(doc: EffectDoc, id: string, label: string): EffectDoc {
  return withClusters(doc, clustersOf(doc).map((g) => {
    if (g.id !== id) return g;
    const { label: _was, ...rest } = g;
    return label === '' ? rest : { ...rest, label };
  }));
}

/** Whether `inner` is `outer` or inside it. Clusters holding each other in a loop end the climb. */
function within(clusters: readonly EffectCluster[], inner: string, outer: string): boolean {
  let at: string | undefined = inner;
  for (let climbed = 0; at !== undefined && climbed <= clusters.length; climbed++, at = parentOf(clusters, at)?.id) if (at === outer) return true;
  return false;
}

/**
 * Moves `ids`, stages or clusters, into cluster `cluster`, or to the top level for
 * `null`, out of the clusters they were in. A cluster left empty goes too unless
 * it has a box. `doc` itself when `cluster` is unknown or inside one of `ids`.
 * One of `ids` inside another goes with it.
 */
export function moveToCluster(doc: EffectDoc, given: readonly string[], cluster: string | null): EffectDoc {
  const clusters = clustersOf(doc);
  if (cluster !== null && (!clusters.some((g) => g.id === cluster) || given.some((id) => within(clusters, cluster, id)))) return doc;
  const ids = outermost(clusters, given);
  const moving = new Set(ids);
  const boxed = (id: string) => id === cluster || (doc.clusterBoxes !== undefined && getOwn(doc.clusterBoxes, id) !== undefined);
  const left = pruneClusters(clusters, moving, boxed);
  const placed = cluster === null ? left : left.map((g) => (g.id === cluster ? { ...g, members: [...g.members, ...ids] } : g));
  return withClusters(doc, placed);
}

/** Sets cluster `id`'s box under `nodeGraph`; `null` has it fit its members again. */
export function setClusterBox(doc: EffectDoc, id: string, box: EffectBox | null): EffectDoc {
  const { [id]: _was, ...rest } = doc.clusterBoxes ?? {};
  return withClusters(doc, clustersOf(doc), box === null ? rest : { ...rest, [id]: { x: box.x, y: box.y, width: box.width, height: box.height } });
}

/** Cluster `id` and every stage and cluster inside it. */
export function clusterContents(doc: EffectDoc, id: string): { stages: Set<string>; clusters: Set<string> } {
  const clusters = new Map(clustersOf(doc).map((g) => [g.id, g]));
  const out = { stages: new Set<string>(), clusters: new Set<string>() };
  const visit = (g: string) => {
    if (out.clusters.has(g)) return;
    out.clusters.add(g);
    for (const m of clusters.get(g)?.members ?? []) {
      if (clusters.has(m)) visit(m);
      else out.stages.add(m);
    }
  };
  if (clusters.has(id)) visit(id);
  return out;
}

/**
 * Moves cluster `id` by `offset`: the places of the stages inside it, its box
 * and the boxes inside it, and the routes of wires with both ends inside it.
 * A stage with no place stays where layout puts it.
 */
export function moveCluster(doc: EffectDoc, id: string, offset: Vec2): EffectDoc {
  const { stages, clusters } = clusterContents(doc, id);
  const by = (p: Vec2) => ({ x: p.x + offset.x, y: p.y + offset.y });
  const places = Object.fromEntries(Object.entries(doc.places).map(([s, p]) => [s, stages.has(s) ? by(p) : p]));
  const inside = new Set(doc.pipeline.wires.flatMap((w) => (w.id !== undefined && stages.has(w.from.stage) && stages.has(w.to.stage) ? [w.id] : [])));
  const routes = doc.routes === undefined ? undefined
    : Object.fromEntries(Object.entries(doc.routes).map(([w, r]) => [w, inside.has(w) ? r.map(by) : r]));
  const boxes = doc.clusterBoxes === undefined ? undefined
    : Object.fromEntries(Object.entries(doc.clusterBoxes).map(([g, b]) => [g, clusters.has(g) ? { ...b, ...by(b) } : b]));
  return {
    ...doc, places,
    ...(routes !== undefined ? { routes } : {}),
    ...(boxes !== undefined ? { clusterBoxes: boxes } : {}),
  };
}
