import { useMemo } from 'react';
import { toolSet, type Tool, type ToolSet } from '@weasel-js/core';
import { useMeasureTool, type UseMeasureToolOptions } from './useMeasureTool';

/** The ids {@link useMeasureTools} keys its tools by. */
export type MeasureToolId = 'measure';

/** Every tool `@weasel-js/measure` ships: the measure tool. */
export const MEASURE_TOOLS: ToolSet<MeasureToolId> = toolSet('measure', ['measure'], { label: 'Measure' });

/**
 * Every tool in {@link MEASURE_TOOLS}, keyed by id, for `<SceneCanvas tools>` beside the
 * `measurementsContribution` whose actions they bind. `options` go to `useMeasureTool`.
 */
export function useMeasureTools(options: UseMeasureToolOptions): Record<MeasureToolId, Tool> {
  const measure = useMeasureTool(options);
  return useMemo(() => ({ measure }), [measure]);
}
