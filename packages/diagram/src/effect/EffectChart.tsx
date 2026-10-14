import { useEffect, useMemo, useState } from 'react';
import { useLatest, type Paint } from '@weasel-js/core';
import { DiagramView, type DiagramViewProps } from '../DiagramView';
import { diagramScene } from '../fromData';
import { checkPipeline, type EffectProblem } from './check';
import type { EffectLook } from './draw';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline } from './types';

/** Props for `EffectChart`. */
export interface EffectChartProps<TOptions = unknown> {
  /** Compared by its JSON, so it may be rebuilt on every render: the chart
   *  lays out again only when that changes. A value JSON drops or flattens
   *  in a stage's `data` (a function, a `Map`) is not seen changing. */
  pipeline: EffectPipeline;
  /** How the pipeline is drawn. Default `nodeGraph`. */
  look?: EffectLook<TOptions>;
  /** The look's options. Keep the object's identity steady between renders,
   *  or the chart lays out again on each one. */
  options?: TOptions;
  width: number;
  height: number;
  /** What the canvas paints behind the chart. Unset, it is transparent; the
   *  shipped looks are drawn for a dark ground. */
  background?: Paint;
  /** A stage id, or null for none. */
  selected?: string | null;
  /** Hears each pick: a stage's id, or `null` for empty canvas and for
   *  anything that is not a stage, such as a group box. The canvas keeps its
   *  own highlight on what was picked; only a change to `selected` moves it. */
  onSelect?: (stage: string | null) => void;
  /** What `checkPipeline` found. Called once on mount, and again each time
   *  the pipeline's content changes. */
  onProblems?: (problems: readonly EffectProblem[]) => void;
  /** A class for the canvas element. */
  className?: string;
}

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
export function EffectChart<TOptions = unknown>({
  pipeline: given, look, options, width, height, background, selected, onSelect, onProblems, className,
}: EffectChartProps<TOptions>) {
  const pipeline = useSameContent(given);
  const problems = useMemo(() => checkPipeline(pipeline), [pipeline]);
  const onProblemsRef = useLatest(onProblems);
  useEffect(() => {
    onProblemsRef.current?.(problems);
  }, [onProblemsRef, problems]);

  const built = useMemo(() => {
    const drawn = ((look ?? nodeGraph) as EffectLook<TOptions>)(pipeline, options);
    const portOptions: DiagramViewProps['portOptions'] = {
      shape: 'circle',
      sizePx: 8,
      // Every port a look declares has a value type; the compass defaults have none.
      showsPort: (port) => port.type !== undefined,
      fill: (port) => ({ paint: { color: drawn.color(port.type) } }),
    };
    return { specs: diagramScene(drawn.data, drawn.scene), portOptions };
  }, [pipeline, look, options]);

  const stageIds = useMemo(() => new Set(pipeline.stages.map((s) => s.id)), [pipeline]);
  return (
    <DiagramView
      key={keyOf(built)}
      specs={built.specs}
      width={width}
      height={height}
      ports="show"
      portOptions={built.portOptions}
      anchor="start"
      {...(background !== undefined ? { background } : {})}
      {...(selected !== undefined ? { selected } : {})}
      {...(onSelect ? { onSelect: (id: string | null) => onSelect(id !== null && stageIds.has(id) ? id : null) } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
