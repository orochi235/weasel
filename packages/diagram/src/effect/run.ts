/**
 * A run drawn over a chart already laid out: data edits on the scene a look
 * built, never a new layout. Whatever a run does not touch keeps the spec it
 * had, so a chart fed a run every frame repaints only what changed.
 */
import type { DiagramSpec } from '../fromData';
import { NO_VALUE, uniqueStages, valueRowId } from './draw';
import type { EffectPipeline, EffectRun } from './types';

/** How far a stage or wire the run passed by is faded. */
const DIM = 0.3;
/** How far a stage's cost sits above its top-right corner. */
const COST_GAP = 2;
/** Of the stage's title size. */
const COST_SCALE = 0.8;

/**
 * `specs` as `run` leaves them: a stage the run never reached faded, with its
 * wires; a decision's wires to the outputs it did not take faded; each value
 * row a look kept filled in; and each stage's cost written above its corner.
 * No run, no change.
 */
export function paintRun(pipeline: EffectPipeline, specs: readonly DiagramSpec[], run: EffectRun | undefined): DiagramSpec[] {
  if (run === undefined) return [...specs];
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const unreached = new Set([...stages.keys()].filter((id) => run.stages[id] === undefined));
  const ownedBy = (spec: DiagramSpec): string | undefined => {
    const id = spec.id as string;
    if (stages.has(id)) return id;
    const parent = spec.parent as string | undefined;
    if (parent !== undefined && stages.has(parent)) return parent;
    const head = id.split('/')[0]!;
    return stages.has(head) ? head : undefined;
  };

  const passed = new Set<string>();
  for (const spec of specs) {
    const ends = wireEnds(spec);
    if (ends === null) continue;
    const taken = run.stages[ends.from]?.taken;
    if (unreached.has(ends.from) || unreached.has(ends.to) || (taken !== undefined && ends.fromPort !== taken)) {
      passed.add(spec.id as string);
    }
  }

  const values = new Map<string, string>();
  for (const [id, stage] of stages) {
    for (const p of stage.outputs ?? []) {
      values.set(`${id}/${valueRowId(p.id)}`, `${p.label ?? p.id}: ${run.stages[id]?.values?.[p.id] ?? NO_VALUE}`);
    }
  }

  const out = specs.map((spec): DiagramSpec => {
    const id = spec.id as string;
    let next = spec;
    const text = values.get(id);
    if (text !== undefined && (spec.data as { text?: string }).text !== text) next = { ...next, data: { ...next.data, text } };
    const owner = ownedBy(spec);
    const dependsOn = spec.dependsOn;
    const onWire = Array.isArray(dependsOn) && dependsOn.length === 1 && passed.has(dependsOn[0] as string);
    if ((owner !== undefined && unreached.has(owner)) || passed.has(id) || onWire) next = { ...next, data: dimmed(next.data) };
    return next;
  });
  for (const spec of specs) {
    const id = spec.id as string;
    const cost = stages.has(id) ? run.stages[id]?.cost : undefined;
    if (cost !== undefined) out.push(costSpec(spec, specs, cost));
  }
  return out;
}

/** An edge spec's two stages and the output it leaves by, or null for any
 *  other spec. */
function wireEnds(spec: DiagramSpec): { from: string; to: string; fromPort: string | undefined } | null {
  const trait = (spec.data as { diagram?: { from?: { port?: string }; to?: unknown } } | undefined)?.diagram;
  const deps = spec.dependsOn;
  if (trait?.from === undefined || trait.to === undefined || !Array.isArray(deps) || deps.length !== 2) return null;
  return { from: deps[0] as string, to: deps[1] as string, fromPort: trait.from.port };
}

/** `data` with every paint it carries faded. */
function dimmed(data: DiagramSpec['data']): DiagramSpec['data'] {
  const fade = (part: unknown): unknown => {
    const paint = (part as { paint?: { opacity?: number } } | undefined)?.paint;
    if (paint === undefined) return part;
    return { ...(part as object), paint: { ...paint, opacity: (paint.opacity ?? 1) * DIM } };
  };
  const d = data as { fill?: unknown; stroke?: unknown };
  return {
    ...data,
    ...(d.fill !== undefined ? { fill: fade(d.fill) } : {}),
    ...(d.stroke !== undefined ? { stroke: fade(d.stroke) } : {}),
  } as DiagramSpec['data'];
}

/** A stage's cost as text above its top-right corner, set in its title's
 *  face a size down and its title's color. */
function costSpec(stage: DiagramSpec, specs: readonly DiagramSpec[], cost: number): DiagramSpec {
  const title = specs.find((s) => s.parent === stage.id && (s.data as { text?: string }).text !== undefined);
  const titleData = (title?.data ?? {}) as { style?: { fontFamily: string; fontSize: number }; fill?: unknown };
  const fontSize = Math.round((titleData.style?.fontSize ?? 12) * COST_SCALE);
  const style = { fontFamily: titleData.style?.fontFamily ?? 'sans-serif', fontSize };
  const text = costText(cost);
  const width = text.length * fontSize * 0.6;
  const height = Math.ceil(fontSize * 1.2);
  const box = stage.pose as { x: number; y: number; width: number };
  return {
    id: `${stage.id as string}/cost` as never,
    kind: 'leaf',
    layer: 'main',
    pickable: false,
    pose: { x: box.x + box.width - width, y: box.y - height - COST_GAP, width, height },
    data: { text, style, ...(titleData.fill !== undefined ? { fill: titleData.fill } : {}) } as DiagramSpec['data'],
  };
}

/** A cost in milliseconds, to three figures. */
export function costText(ms: number): string {
  if (ms >= 100) return `${Math.round(ms)} ms`;
  return `${Number(ms.toPrecision(3))} ms`;
}
