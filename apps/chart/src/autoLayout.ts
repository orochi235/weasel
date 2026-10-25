import { useCommand } from '@weasel-js/core';
import { layoutDiagram, type DiagramType, type ParticipantSource } from '@weasel-js/diagram';
import { CHART_ACTIONS } from './chartCommands';
import type { ChartPose, ChartScene } from './chartDocument';
import { can } from './menuBar';

/** Runs `type`'s layout over the chart as one undo entry, and returns how many shapes moved: none for a type with no
 *  layout. */
export function autoLayout(scene: ChartScene, type: DiagramType, participants: ParticipantSource<ChartPose>): number {
  if (type.layout === undefined) return 0;
  return layoutDiagram(scene as never, participants, type.layout, { label: 'Auto layout' });
}

/** Registers Arrange › Auto layout, which is off while the chart's type has no layout. */
export function useAutoLayoutCommand(scene: ChartScene, type: DiagramType, participants: ParticipantSource<ChartPose>): void {
  useCommand(CHART_ACTIONS.autoLayout, 'Auto layout', () => { autoLayout(scene, type, participants); }, {
    enabled: () => can(type.layout !== undefined),
  });
}
