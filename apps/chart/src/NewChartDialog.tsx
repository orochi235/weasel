import { FLOWCHART_TYPE, rendererMeasure } from '@weasel-js/diagram';
import { templateSpecs, type PageTemplate } from '@weasel-js/diagram-formats';
import { useNewCommand } from '@weasel-js/editor';
import { useState, type ReactElement } from 'react';
import { CHART_ACTIONS } from './chartCommands';
import { CHART_PAGE, chartDoc, type ChartScene } from './chartDocument';
import { replaceChart } from './chartPersistence';
import { TemplateDialog } from './templates/TemplateDialog';
import { chartThemeOf } from './theme/themeCommands';

/** File › New…: a dialog listing every page template, which replaces the chart with a one-page chart made from the
 *  template chosen, in the chart's theme. */
export function NewChart({ scene }: { scene: ChartScene }): ReactElement | null {
  const [open, setOpen] = useState(false);
  useNewCommand(CHART_ACTIONS.new, 'New…', () => setOpen(true));
  if (!open) return null;
  const create = (template: PageTemplate) => {
    const { specs, doc } = templateSpecs(template, { layer: 'shapes', theme: chartThemeOf(scene), measure: rendererMeasure, size: CHART_PAGE });
    replaceChart(scene, { specs, doc: chartDoc(doc) }, 'New chart');
    setOpen(false);
  };
  return <TemplateDialog title="New Chart" action="Create" initial={FLOWCHART_TYPE.id} onChoose={create} onClose={() => setOpen(false)} />;
}
