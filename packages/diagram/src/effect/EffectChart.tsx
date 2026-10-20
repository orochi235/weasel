import { useEffect, useMemo, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import { DiagramView } from '../DiagramView';
import { diagramScene } from '../fromData';
import { checkPipeline, type EffectProblem } from './check';
import type { EffectLook } from './draw';
import { nodeGraph } from './nodeGraph';
import { useReleaseReplaced } from './releaseReplaced';
import { paintRun } from './run';
import { useRunPortOptions } from './runPorts';
import type { EffectPipeline, EffectRun } from './types';

/** Props for `EffectChart`. */
export interface EffectChartProps<TOptions = never> {
  /** Compared by its JSON, so it may be rebuilt on every render: the chart
   *  lays out again only when that changes. A value JSON drops or flattens
   *  in a stage's `data` (a function, a `Map`) is not seen changing. */
  pipeline: EffectPipeline;
  /** One run of the pipeline, drawn over it: stages it never reached and
   *  branches it did not take faded, each stage's cost above its corner, and
   *  each output's value and preview in the rows a look keeps for them
   *  (`showValues`, `showPreviews`). It may change every frame: the chart
   *  neither lays out again nor refits, and repaints only what changed. A
   *  preview the next run no longer shows has its texture freed then. */
  run?: EffectRun;
  /** How the pipeline is drawn. Default `nodeGraph`. */
  look?: EffectLook<TOptions>;
  /** The look's options. Keep the object's identity steady between renders,
   *  or the chart lays out again on each one. */
  options?: TOptions;
  /** CSS pixels. Omit both to fill the parent, which then needs a size of
   *  its own. The chart refits when its size changes, until the user pans or
   *  zooms. */
  width?: number;
  height?: number;
  /** The smallest scale the chart opens at. A chart that does not fit whole
   *  at it opens at it anyway, anchored at its start, and the rest is a pan
   *  away. Default `EFFECT_MIN_SCALE`. */
  minScale?: number;
  /** What the canvas paints behind the chart. Unset, it is transparent; the
   *  shipped looks are drawn for a dark ground. */
  background?: Paint;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for anything else. Only a
   *  stage can be picked: a click on a group box or a lane lands on the
   *  canvas behind it. The canvas keeps its own highlight on the stage picked;
   *  only a change to `selected` moves it. */
  onSelect?: (stage: string | null) => void;
  /** What `checkPipeline` found. Called once on mount, and again each time
   *  the pipeline's content changes. */
  onProblems?: (problems: readonly EffectProblem[]) => void;
  /** A class for the canvas element. */
  className?: string;
}

/** `EffectChart`'s default `minScale`: the shipped looks' 12px titles at 6px, the smallest still legible. */
export const EFFECT_MIN_SCALE = 0.5;

const keys = new WeakMap<object, number>();
let nextKey = 0;
/** A React key that changes when the built scene does, so a new pipeline or
 *  look opens fitted and laid out afresh. */
function keyOf(built: object): number {
  let key = keys.get(built);
  if (key === undefined) {
    key = nextKey++;
    keys.set(built, key);
  }
  return key;
}

function contentOf(value: unknown): string | null {
  try {
    return JSON.stringify(value) ?? null;
  } catch {
    return null;
  }
}

/** `value`, or the object an earlier render passed when this one serializes
 *  to the same JSON. A value that cannot be serialized is compared by identity. */
function useSameContent<T>(value: T): T {
  const [kept, setKept] = useState(() => ({ value, content: contentOf(value) }));
  if (kept.value === value) return value;
  const content = contentOf(value);
  if (content !== null && content === kept.content) return kept.value;
  setKept({ value, content });
  return value;
}

/** A chart of an effects pipeline: pan, zoom, and pick a stage. Text paints
 *  only in a registered font family, so call `registerCanvasFont('sans-serif')`
 *  once before mounting one. */
export function EffectChart<TOptions = never>({
  pipeline: given, run, look, options, width, height, minScale = EFFECT_MIN_SCALE, background, selected, onSelect, onProblems, className,
}: EffectChartProps<TOptions>) {
  const pipeline = useSameContent(given);
  const problems = useMemo(() => checkPipeline(pipeline), [pipeline]);
  const onProblemsRef = useLatest(onProblems);
  useEffect(() => {
    onProblemsRef.current?.(problems);
  }, [onProblemsRef, problems]);

  const stageIds = useMemo(() => new Set(pipeline.stages.map((s) => s.id)), [pipeline]);
  const built = useMemo(() => {
    const drawn = ((look ?? nodeGraph) as EffectLook<TOptions>)(pipeline, options);
    // Only a stage is pickable: the canvas highlights whatever it picks, and
    // a group box or a lane picked would stay lit while `onSelect` says none.
    const specs = diagramScene(drawn.data, drawn.scene)
      .map((s) => (s.pickable === false || stageIds.has(s.id as string) ? s : { ...s, pickable: false }));
    return { specs, color: drawn.color, exits: drawn.exits };
  }, [pipeline, look, options, stageIds]);

  const portOptions = useRunPortOptions(built.color, pipeline, run);

  // Keyed by the layout alone: a run edits the scene in place.
  const painted = useMemo(() => paintRun(pipeline, built.specs, run, built.exits), [pipeline, built, run]);
  useReleaseReplaced(run);

  return (
    <DiagramView
      key={keyOf(built)}
      specs={painted}
      width={width}
      height={height}
      minScale={minScale}
      ports="show"
      portOptions={portOptions}
      anchor="start"
      {...(background !== undefined ? { background } : {})}
      {...(selected !== undefined ? { selected } : {})}
      {...(onSelect ? { onSelect: (id: string | null) => onSelect(id !== null && stageIds.has(id) ? id : null) } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
