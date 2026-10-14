import { useEffect, useMemo } from 'react';
import { DiagramView, type DiagramViewProps } from '../DiagramView';
import { diagramScene } from '../fromData';
import { checkPipeline, type EffectProblem } from './check';
import type { EffectLook } from './draw';
import { nodeGraph } from './nodeGraph';
import type { EffectPipeline } from './types';

/** Props for `EffectChart`. */
export interface EffectChartProps<TOptions = unknown> {
  pipeline: EffectPipeline;
  /** How the pipeline is drawn. Default `nodeGraph`. */
  look?: EffectLook<TOptions>;
  /** The look's options. Keep the object's identity steady between renders,
   *  or the chart lays out again on each one. */
  options?: TOptions;
  width: number;
  height: number;
  /** A stage id, or null for none. */
  selected?: string | null;
  onSelect?: (stage: string | null) => void;
  /** What `checkPipeline` found, each time the pipeline changes. */
  onProblems?: (problems: readonly EffectProblem[]) => void;
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

/** A chart of an effects pipeline: pan, zoom, and pick a stage. Text paints
 *  only in a registered font family, so call `registerCanvasFont('sans-serif')`
 *  once before mounting one. */
export function EffectChart<TOptions = unknown>({
  pipeline, look, options, width, height, selected, onSelect, onProblems, className,
}: EffectChartProps<TOptions>) {
  const problems = useMemo(() => checkPipeline(pipeline), [pipeline]);
  useEffect(() => onProblems?.(problems), [onProblems, problems]);

  const built = useMemo(() => {
    const drawn = ((look ?? nodeGraph) as EffectLook<TOptions>)(pipeline, options);
    const portOptions: DiagramViewProps['portOptions'] = {
      shape: 'circle',
      sizePx: 8,
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
      {...(selected !== undefined ? { selected } : {})}
      {...(onSelect ? { onSelect: (id: string | null) => onSelect(id !== null && stageIds.has(id) ? id : null) } : {})}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
