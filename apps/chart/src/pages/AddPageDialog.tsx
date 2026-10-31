import { pagesOf } from '@weasel-js/core';
import { DIAGRAM_TYPES, addStencilGroup, diagramTypeOf, rendererMeasure, type DiagramTheme } from '@weasel-js/diagram';
import { addTemplatePage, type PageTemplate } from '@weasel-js/diagram-formats';
import type { ReactElement } from 'react';
import type { ChartScene } from '../chartDocument';
import { TemplateDialog } from '../templates/TemplateDialog';
import type { ChartPages } from './useChartPages';

/**
 * Adds a page made from `template` after the page in view, a graph page the size of that one, and goes to it. A graph
 * page's stencil groups join the Shapes panel's, so its symbols are there to draw with. One undo entry.
 */
export function addChartPage(scene: ChartScene, pages: ChartPages, template: PageTemplate, theme: DiagramTheme): void {
  const list = pagesOf(scene)?.pages ?? [];
  const at = list.findIndex((p) => p.id === pages.shown?.id);
  const like = list[at] ?? list[list.length - 1];
  const groups = template.diagramType !== undefined ? DIAGRAM_TYPES[template.diagramType]?.groups ?? [] : [];
  const id = scene.batch('Add page', () => {
    const added = addTemplatePage(scene, template, {
      layer: 'shapes', theme, measure: rendererMeasure, index: at < 0 ? list.length : at + 1,
      ...(like !== undefined ? { size: { width: like.width, height: like.height } } : {}),
    });
    for (const g of groups) addStencilGroup(scene, g);
    return added;
  });
  pages.goTo(id);
}

/** Page › Add Page…: the page templates, the chart's own type chosen to start, the one taken added after the page in view. */
export function AddPageDialog({ scene, pages, theme, onClose }: {
  scene: ChartScene;
  pages: ChartPages;
  theme: DiagramTheme;
  onClose(): void;
}): ReactElement {
  const add = (template: PageTemplate) => {
    addChartPage(scene, pages, template, theme);
    onClose();
  };
  return <TemplateDialog title="Add Page" action="Add" initial={diagramTypeOf(scene).id} onChoose={add} onClose={onClose} />;
}
