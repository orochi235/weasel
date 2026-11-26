/**
 * Opacity as clip targets. An import multiplies every enclosing `opacity`, and a shape's own
 * `fill-opacity` and `stroke-opacity`, into each leaf's paints, so one element's opacity is one
 * target spread over every leaf it fades. Each leaf's paints are rebuilt from what they were
 * before any fading, times every factor as it stands, so a factor that starts at 0 can rise and
 * two animated factors over one leaf both show.
 */
import { createTarget, type Target } from '@weasel-js/animator';
import { restDataField, showDataField, type DataLens, type DataTargetScene, type NodeId } from '@weasel-js/core';
import { mapFillPaint } from './fillPaint';
import type { DraftFade } from './draftFades';
import type { SvgKitLeafData } from './fromKit';
import type { Paint, Stroke } from '@weasel-js/core';
import type { StyledRun } from '@weasel-js/text';

/** A leaf a fade reaches: its node, its fades, and the fill and stroke opacity it shows at full strength. */
export interface FadedLeaf {
  readonly node: string;
  readonly source: string | undefined;
  readonly fade: DraftFade;
  /** Its `fill-opacity` and `stroke-opacity` where a clip moves them; they are divided out of its unfaded paints. */
  readonly own: { fill?: number; stroke?: number };
}

type Data = SvgKitLeafData & Record<string, unknown>;

const isPaintHolder = (v: unknown): v is { paint?: Paint } => typeof v === 'object' && v !== null;

const opacityTo = (p: Paint | undefined, base: Paint | undefined, k: number): Paint | undefined =>
  p && { ...p, opacity: (base?.opacity ?? 1) * k };

function strokeTo(stroke: unknown, base: unknown, k: number): unknown {
  if (!isPaintHolder(stroke) || !stroke.paint) return stroke;
  return { ...(stroke as Stroke), paint: opacityTo(stroke.paint, (base as Stroke | undefined)?.paint, k) };
}

/** `data` with its paints at `fill` and `stroke` times what they are unfaded. */
function faded(data: Data, unfaded: Data, fill: number, stroke: number): Data {
  const out: Data = { ...data };
  if (isPaintHolder(data.fill) && 'paint' in data.fill) {
    out.fill = { ...data.fill, paint: opacityTo(data.fill.paint, (unfaded.fill as { paint?: Paint } | undefined)?.paint, fill) } as Data['fill'];
  } else if (typeof data.text === 'string' && data.fill && isPaintHolder(unfaded.fill)) {
    out.fill = mapFillPaint(unfaded.fill as never, (p: Paint) => ({ ...p, opacity: (p.opacity ?? 1) * fill })) as Data['fill'];
  }
  if (data.stroke !== undefined) out.stroke = strokeTo(data.stroke, unfaded.stroke, stroke) as Data['stroke'];
  if (Array.isArray(unfaded.runs)) {
    out.runs = (unfaded.runs as StyledRun[]).map((r) => ({
      ...r,
      ...(r.fill ? { fill: mapFillPaint(r.fill, (p) => ({ ...p, opacity: (p.opacity ?? 1) * fill })) } : {}),
      ...(r.stroke ? { stroke: strokeTo(r.stroke, r.stroke, stroke) as Stroke } : {}),
    }));
  }
  if (isPaintHolder(data.image)) out.image = { ...(data.image as object), opacity: fill } as Data['image'];
  return out;
}

/**
 * A maker of opacity targets over `leaves`: `target(key)` is the target of `<id>.opacity`,
 * `<id>.fill-opacity` or `<id>.stroke-opacity`, spread over each leaf the factor reaches, or
 * undefined where it reaches none. `statics` holds each factor's value in the document.
 */
export function createFadeTargets(
  scene: DataTargetScene<Data>,
  leaves: readonly FadedLeaf[],
  statics: ReadonlyMap<string, number>,
): (key: string) => Target<number> | undefined {
  const committed = new Map(statics);
  const shown = new Map<string, number>();
  const targets = new Map<string, Target<number>>();
  const factor = (key: string): number => shown.get(key) ?? committed.get(key) ?? 1;

  /** The keys that fade `leaf`, each with whether it reaches fill, stroke, or both. */
  const keysOf = (leaf: FadedLeaf): [string, 'both' | 'fill' | 'stroke'][] => [
    ...Object.keys(leaf.fade.by).map((id): [string, 'both'] => [`${id}.opacity`, 'both']),
    ...(leaf.own.fill !== undefined ? [[`${leaf.source}.fill-opacity`, 'fill'] as [string, 'fill']] : []),
    ...(leaf.own.stroke !== undefined ? [[`${leaf.source}.stroke-opacity`, 'stroke'] as [string, 'stroke']] : []),
  ];

  const lensOf = (leaf: FadedLeaf): DataLens<Data, [number, number]> => {
    const unfaded = leaf.fade.unfaded as Data;
    // A paint opacity a clip moves is taken back out of the unfaded paint, which carries it. Where
    // it is 0, nothing of the color's own alpha survived, and the color is taken as opaque.
    const base: Data = { ...unfaded };
    const without = (holder: unknown, own: number | undefined): unknown =>
      own === undefined || !isPaintHolder(holder) || !holder.paint ? holder
        : { ...holder, paint: { ...holder.paint, opacity: own > 0 ? (holder.paint.opacity ?? 1) / own : 1 } };
    base.fill = without(unfaded.fill, leaf.own.fill) as Data['fill'];
    base.stroke = without(unfaded.stroke, leaf.own.stroke) as Data['stroke'];
    return { key: 'svg:fade', get: () => [1, 1], with: (data, [f, s]) => faded(data, base, f, s) };
  };
  const lenses = new Map(leaves.map((l) => [l, lensOf(l)]));

  const strengthOf = (leaf: FadedLeaf): [number, number] => {
    let fill = leaf.fade.rest;
    let stroke = leaf.fade.rest;
    for (const [key, reach] of keysOf(leaf)) {
      const k = factor(key);
      if (reach !== 'stroke') fill *= k;
      if (reach !== 'fill') stroke *= k;
    }
    return [fill, stroke];
  };

  return (key) => {
    const held = targets.get(key);
    if (held) return held;
    const reached = leaves.filter((l) => keysOf(l).some(([k]) => k === key) && scene.get(l.node as NodeId));
    if (reached.length === 0) return undefined;
    const target: Target<number> = createTarget<number>({
      get: () => committed.get(key) ?? 1,
      set(value) {
        committed.set(key, value);
        for (const leaf of reached) {
          const n = scene.get(leaf.node as NodeId);
          if (n) scene.untracked(() => scene.update(leaf.node as NodeId, { data: lenses.get(leaf)!.with(n.data, strengthOf(leaf)) }));
        }
      },
      show(value) {
        if (target.active) shown.set(key, value);
        else shown.delete(key);
        for (const leaf of reached) {
          const live = keysOf(leaf).some(([k]) => shown.has(k));
          if (live) showDataField(scene, leaf.node, lenses.get(leaf)!, strengthOf(leaf));
          else restDataField(scene, leaf.node, 'svg:fade');
        }
      },
      publish: () => scene.overrides.commit(),
    });
    targets.set(key, target);
    return target;
  };
}
