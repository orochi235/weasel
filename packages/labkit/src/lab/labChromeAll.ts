import { useMemo } from 'react';
import { labAnnotationTools } from '../annotations/toolMap';
import { labContributions } from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import type { InstrumentList } from '../instrument/types';
import type { TrialTool } from '../tools/types';

/** Every tool the lab's rail carries: the annotation tools while the lab shows marks, then the lab's own. */
export function useLabTools(
  instruments: InstrumentList,
  marks: boolean,
  tools: readonly TrialTool[] | undefined,
): readonly TrialTool[] {
  return useMemo(
    () => [...(marks ? labAnnotationTools(instruments) : []), ...(tools ?? [])],
    [instruments, marks, tools],
  );
}

/**
 * The lab's own chrome with its tools. Tools and lab contributions share one id namespace, so they merge once here —
 * before any region renders — and a collision throws rather than one of them silently losing. Declaring
 * `annotations` on any instrument puts the drawing tools in the rail while the lab shows marks: one tool is armed
 * across every trial.
 */
export function useLabChromeAll(
  allTools: readonly TrialTool[],
  labChrome: readonly LabContribution[] | undefined,
): LabContribution[] {
  return useMemo(() => labContributions(allTools, labChrome), [allTools, labChrome]);
}
