import { useMemo } from 'react';
import type { DiagramViewProps } from '../DiagramView';
import type { TypeColor } from './draw';
import { DIM, unreachedStages } from './run';
import type { EffectPipeline, EffectRun } from './types';

/** The port dots a chart of a pipeline draws: one per port with a value type,
 *  in its type's color, faded on a stage `run` never reached. Kept while a new
 *  run misses the same stages, so a run that only changes values keeps the
 *  port layer. */
export function useRunPortOptions(color: TypeColor, pipeline: EffectPipeline, run: EffectRun | undefined): DiagramViewProps['portOptions'] {
  const missed = JSON.stringify([...unreachedStages(pipeline, run)].sort());
  return useMemo((): DiagramViewProps['portOptions'] => {
    const faded = new Set(JSON.parse(missed) as string[]);
    return {
      shape: 'circle',
      sizePx: 8,
      // Every port a look declares has a value type; the compass defaults have none.
      showsPort: (port) => port.type !== undefined,
      fill: (port) => ({ paint: { color: color(port.type), ...(faded.has(port.nodeId) ? { opacity: DIM } : {}) } }),
    };
  }, [color, missed]);
}
