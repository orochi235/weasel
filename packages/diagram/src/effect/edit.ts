import type { Vec2 } from '@weasel-js/core/math';
import { pruneGroups } from './groupEdit';
import { pruneLookRoutes } from './lookRoutes';
import { formatParam } from './stageTypes';
import type { EffectDoc, EffectParam, EffectParamControl, EffectPipeline, EffectStage, EffectWire } from './types';

type Ref = { stage: string; port: string };

const withPipeline = (doc: EffectDoc, pipeline: Partial<EffectPipeline>): EffectDoc => ({
  ...doc,
  pipeline: { ...doc.pipeline, ...pipeline },
});

/** `base` if no stage has it, else `base-2`, `base-3`, … */
export function nextStageId(p: EffectPipeline, base: string): string {
  const used = new Set(p.stages.map((s) => s.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** The first of `w1`, `w2`, … no wire has. */
export function nextWireId(p: EffectPipeline): string {
  const used = new Set(p.wires.map((w) => w.id));
  let n = 1;
  while (used.has(`w${n}`)) n++;
  return `w${n}`;
}

/** Appends the stage, pinning it at `at` when given. */
export function addStage(doc: EffectDoc, stage: EffectStage, at?: Vec2): EffectDoc {
  const next = withPipeline(doc, { stages: [...doc.pipeline.stages, stage] });
  return at ? { ...next, places: { ...doc.places, [stage.id]: { x: at.x, y: at.y } } } : next;
}

/** Drops the stages with their wires, places, routes and group memberships,
 *  and any group that leaves empty, with its box. */
export function removeStages(doc: EffectDoc, ids: readonly string[]): EffectDoc {
  const gone = new Set(ids);
  const { groups } = doc.pipeline;
  const wires = doc.pipeline.wires.filter((w) => !gone.has(w.from.stage) && !gone.has(w.to.stage));
  const kept = groups ? pruneGroups(groups, gone) : undefined;
  const left = new Set(kept?.map((g) => g.id));
  const boxes = doc.groupBoxes === undefined ? undefined : Object.entries(doc.groupBoxes).filter(([id]) => left.has(id));
  const { groupBoxes: _was, ...rest } = doc;
  return pruneRoutes({
    ...rest,
    pipeline: {
      ...doc.pipeline,
      stages: doc.pipeline.stages.filter((s) => !gone.has(s.id)),
      wires,
      ...(kept ? { groups: kept } : {}),
    },
    places: Object.fromEntries(Object.entries(doc.places).filter(([id]) => !gone.has(id))),
    ...(boxes !== undefined && boxes.length > 0 ? { groupBoxes: Object.fromEntries(boxes) } : {}),
  });
}

/** `doc` keeping only the routes, under every look, of wires it still has,
 *  less those of the `rewired` wires, whose ends now join other ports. */
export function pruneRoutes(doc: EffectDoc, rewired: readonly string[] = []): EffectDoc {
  const pruned = pruneLookRoutes(doc, rewired);
  if (pruned.routes === undefined) return pruned;
  const ids = new Set(doc.pipeline.wires.flatMap((w) => (w.id === undefined || rewired.includes(w.id) ? [] : [w.id])));
  return { ...pruned, routes: Object.fromEntries(Object.entries(pruned.routes).filter(([id]) => ids.has(id))) };
}

/** Routes wire `wire` through `points`; none clears its route. */
export function setWireRoute(doc: EffectDoc, wire: string, points: readonly Vec2[]): EffectDoc {
  const { [wire]: _was, ...rest } = doc.routes ?? {};
  return { ...doc, routes: points.length > 0 ? { ...rest, [wire]: points.map((p) => ({ x: p.x, y: p.y })) } : rest };
}

/** Mints an id when the wire has none. */
export function addWire(doc: EffectDoc, wire: EffectWire): EffectDoc {
  const w = wire.id === undefined ? { ...wire, id: nextWireId(doc.pipeline) } : wire;
  return withPipeline(doc, { wires: [...doc.pipeline.wires, w] });
}

/** An id-less wire is never matched: run `ensureWireIds` first. */
export function removeWires(doc: EffectDoc, ids: readonly string[]): EffectDoc {
  const gone = new Set(ids);
  return pruneRoutes(withPipeline(doc, { wires: doc.pipeline.wires.filter((w) => w.id === undefined || !gone.has(w.id)) }));
}

/** An id-less wire is never matched: run `ensureWireIds` first. */
export function reconnectWire(doc: EffectDoc, id: string, end: 'from' | 'to', to: Ref): EffectDoc {
  return withPipeline(doc, {
    wires: doc.pipeline.wires.map((w) => (w.id === id ? { ...w, [end]: { stage: to.stage, port: to.port } } : w)),
  });
}

const addressed = (p: EffectParam, key: string) => (p.id ?? p.label) === key;

/** Replaces a param's control and re-formats its display value. */
export function setParam(doc: EffectDoc, stage: string, param: string, control: EffectParamControl): EffectDoc {
  return withPipeline(doc, {
    stages: doc.pipeline.stages.map((s) =>
      s.id !== stage || !s.params
        ? s
        : { ...s, params: s.params.map((p) => (addressed(p, param) ? { ...p, control, value: formatParam(control) } : p)) },
    ),
  });
}

/** Pins each stage at its new position. */
export function moveStages(doc: EffectDoc, moves: readonly { id: string; x: number; y: number }[]): EffectDoc {
  const places = { ...doc.places };
  for (const m of moves) places[m.id] = { x: m.x, y: m.y };
  return { ...doc, places };
}

/** Sets the value types whose lanes `lanes` draws first, top down. */
export function setLaneOrder(doc: EffectDoc, order: readonly string[]): EffectDoc {
  return { ...doc, laneOrder: [...order] };
}

/** Mints ids for id-less wires; returns `doc` itself when none lacks one. */
export function ensureWireIds(doc: EffectDoc): EffectDoc {
  if (doc.pipeline.wires.every((w) => w.id !== undefined)) return doc;
  const used = new Set(doc.pipeline.wires.map((w) => w.id));
  let n = 1;
  const wires = doc.pipeline.wires.map((w) => {
    if (w.id !== undefined) return w;
    while (used.has(`w${n}`)) n++;
    const id = `w${n}`;
    used.add(id);
    return { ...w, id };
  });
  return withPipeline(doc, { wires });
}

/** An output into an input of the same type, both existing, on different stages. */
export function canWire(p: EffectPipeline, from: Ref, to: Ref): boolean {
  if (from.stage === to.stage) return false;
  const out = p.stages.find((s) => s.id === from.stage)?.outputs?.find((x) => x.id === from.port);
  const inn = p.stages.find((s) => s.id === to.stage)?.inputs?.find((x) => x.id === to.port);
  return out !== undefined && inn !== undefined && out.type === inn.type;
}
