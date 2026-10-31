import { plotRootContaining, plotRootOf, replacePlotData } from '@weasel-js/plot';
import { PlotDataPanel } from '@weasel-js/ui/components/PlotDataPanel';
import type { ReactElement } from 'react';
import type { ChartScene } from './chartDocument';

/** The Format sidebar's Data panel: the data of the chart the selection is in, its root or one of its marks, each
 *  edit one undo entry. Nothing while the selection is in no chart, or in more than one. */
export function PlotDataSection({ scene, selected }: { scene: ChartScene; selected: readonly string[] }): ReactElement | null {
  const roots = new Set(selected.flatMap((id) => plotRootContaining(scene as never, id) ?? []));
  if (roots.size !== 1) return null;
  const [rootId] = roots as Set<string>;
  const trait = plotRootOf(scene.get(rootId as never));
  if (trait === null) return null;
  return <PlotDataPanel data={trait.data} onChange={(next, label) => replacePlotData(scene, rootId, next, { label })} />;
}
