import type { Vec2 } from '@weasel-js/core/math';
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

export function addStage(doc: EffectDoc, stage: EffectStage, at?: Vec2): EffectDoc {
  const next = withPipeline(doc, { stages: [...doc.pipeline.stages, stage] });
  return at ? { ...next, places: { ...doc.places, [stage.id]: { x: at.x, y: at.y } } } : next;
}

/** Drops the stages with their wires, places and group memberships. */
export function removeStages(doc: EffectDoc, ids: readonly string[]): EffectDoc {
  const gone = new Set(ids);
  const { groups } = doc.pipeline;
  return {
    pipeline: {
      ...doc.pipeline,
      stages: doc.pipeline.stages.filter((s) => !gone.has(s.id)),
      wires: doc.pipeline.wires.filter((w) => !gone.has(w.from.stage) && !gone.has(w.to.stage)),
      ...(groups ? { groups: groups.map((g) => ({ ...g, members: g.members.filter((m) => !gone.has(m)) })) } : {}),
    },
    places: Object.fromEntries(Object.entries(doc.places).filter(([id]) => !gone.has(id))),
  };
}

/** Mints an id when the wire has none. */
export function addWire(doc: EffectDoc, wire: EffectWire): EffectDoc {
  const w = wire.id === undefined ? { ...wire, id: nextWireId(doc.pipeline) } : wire;
  return withPipeline(doc, { wires: [...doc.pipeline.wires, w] });
}

export function removeWires(doc: EffectDoc, ids: readonly string[]): EffectDoc {
  const gone = new Set(ids);
  return withPipeline(doc, { wires: doc.pipeline.wires.filter((w) => w.id === undefined || !gone.has(w.id)) });
}

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

export function moveStages(doc: EffectDoc, moves: readonly { id: string; x: number; y: number }[]): EffectDoc {
  const places = { ...doc.places };
  for (const m of moves) places[m.id] = { x: m.x, y: m.y };
  return { ...doc, places };
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
