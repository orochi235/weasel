import { useMemo } from 'react';
import { labAnnotationTools } from '../annotations/toolMap';
import { labContributions } from '../chrome/LabChrome';
import type { LabContribution } from '../chrome/labTypes';
import type { InstrumentList } from '../instrument/types';
import type { TrialTool } from '../tools/types';

/** The lab's chrome, as its regions and its options palette read it. */
export interface LabChromeAll {
  /** Every tool the rail carries: the annotation tools while the lab shows marks, then the lab's own. */
  tools: readonly TrialTool[];
  /** Every contribution, the tools' palette items among them. */
  all: LabContribution[];
  hasFooter: boolean;
  /** Whether anything goes in a sidebar or aside pane. */
  hasPanes: boolean;
}

/**
 * The lab's own chrome with its tools. Tools and lab contributions share one id namespace, so they merge once here —
 * before any region renders — and a collision throws rather than one of them silently losing. Declaring
 * `annotations` on any instrument puts the drawing tools in the rail while the lab shows marks: one tool is armed
 * across every trial.
 */
export function useLabChromeAll(
  instruments: InstrumentList,
  marks: boolean,
  tools: readonly TrialTool[] | undefined,
  labChrome: readonly LabContribution[] | undefined,
): LabChromeAll {
  return useMemo(() => {
    const allTools = [...(marks ? labAnnotationTools(instruments) : []), ...(tools ?? [])];
    const all = labContributions(allTools, labChrome);
    return {
      tools: allTools,
      all,
      hasFooter: all.some((c) => c.region === 'footer'),
      hasPanes: all.some((c) => c.region === 'sidebar' || c.region === 'aside'),
    };
  }, [instruments, marks, tools, labChrome]);
}
