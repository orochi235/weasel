import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, createScene, placedPagesOf, type PagesDoc, type RectPose } from '@weasel-js/core';
import { DIAGRAM_TYPES, DIAGRAM_TYPE_DOC_KEY, withDiagramRegistry, type DiagramTypeDoc } from '@weasel-js/diagram';
import type { PlotKind } from '@weasel-js/plot';
import type { DiagramDocument, GraphPage } from '../document';
import { documentFromScene } from '../fromScene';
import { DIAGRAM_MERMAID } from '../mermaid/format';
import { scenePageKinds } from '../pageKinds';
import { MEASURE, THEME } from '../testing/docScene';
import { PAGE_TEMPLATES, type PageTemplate } from './catalog';
import { PLOT_STARTERS, SEQUENCE_STARTER } from './starters';
import { addTemplatePage, templateSpecs } from './templateScene';

const sceneOf = (template: PageTemplate) => {
  const { specs, doc } = templateSpecs(template, { theme: THEME, measure: MEASURE });
  return createScene<unknown, string, RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc, initial: specs as never });
};

describe('page templates', () => {
  it('cover every diagram type, the sequence diagram, and every chart kind', () => {
    const groups = Object.values(PAGE_TEMPLATES).map((t) => t.group);
    expect(groups.filter((g) => g === 'diagram')).toHaveLength(Object.keys(DIAGRAM_TYPES).length);
    expect(groups.filter((g) => g === 'sequence')).toHaveLength(1);
    expect(groups.filter((g) => g === 'chart')).toHaveLength(Object.keys(PLOT_STARTERS).length);
  });

  it.each([['sequence', SEQUENCE_STARTER], ...Object.entries(PLOT_STARTERS).map(([k, s]) => [k, s.source])])(
    'reads the %s starter with no warning',
    (_kind, source) => {
      expect((DIAGRAM_MERMAID.read!(source) as { warnings: readonly string[] }).warnings).toEqual([]);
    },
  );

  it.each(Object.keys(PLOT_STARTERS) as PlotKind[])('draws a %s chart and reads it back as one', (kind) => {
    const page = documentFromScene(sceneOf(PAGE_TEMPLATES[`plot:${kind}`]!)).pages[0]!;
    expect(page.kind === 'plot' && page.data.kind).toBe(kind);
  });

  it('tells a chart\'s page kinds apart without reading it, a plot page among them', () => {
    const scene = sceneOf(PAGE_TEMPLATES['plot:pie']!);
    expect([...scenePageKinds(scene)]).toEqual(['plot']);
    addTemplatePage(scene, PAGE_TEMPLATES.flowchart!, { theme: THEME });
    expect([...scenePageKinds(scene)].sort()).toEqual(['graph', 'plot']);
  });

  it('draws a sequence diagram and reads it back as one', () => {
    const page = documentFromScene(sceneOf(PAGE_TEMPLATES.sequence!)).pages[0]!;
    expect(page.kind).toBe('sequence');
  });

  it.each(Object.keys(DIAGRAM_TYPES))('opens a %s chart as its type, its page in its notation', (id) => {
    const scene = sceneOf(PAGE_TEMPLATES[id]!);
    expect((scene.doc.get(DIAGRAM_TYPE_DOC_KEY) as DiagramTypeDoc).type).toBe(id);
    const page = documentFromScene(scene).pages[0] as GraphPage;
    const notation = DIAGRAM_TYPES[id]!.notations?.[0];
    expect(page.notation).toBe(notation === 'flowchart' ? undefined : notation);
  });

  it('adds a page of another kind to a chart, with what it draws, as one undo entry', () => {
    const scene = sceneOf(PAGE_TEMPLATES.umlClass!);
    const pie = addTemplatePage(scene, PAGE_TEMPLATES['plot:pie']!, { theme: THEME, measure: MEASURE });
    const flow = addTemplatePage(scene, PAGE_TEMPLATES.flowchart!, { theme: THEME, index: 0, size: { width: 500, height: 400 } });
    const doc: DiagramDocument = documentFromScene(scene);
    expect(doc.pages.map((p) => [p.id, p.kind])).toEqual([[flow, 'graph'], ['page-1', 'graph'], [pie, 'plot']]);
    expect((doc.pages[0] as GraphPage).notation).toBeUndefined();
    expect((doc.pages[1] as GraphPage).notation).toBe('class');
    expect(placedPagesOf(scene)[0]).toMatchObject({ width: 500, height: 400 });
    scene.undo();
    expect((scene.doc.get(PAGES_DOC_KEY) as PagesDoc).pages.map((p) => p.id)).toEqual(['page-1', pie]);
    scene.undo();
    expect((scene.doc.get(PAGES_DOC_KEY) as PagesDoc).pages.map((p) => p.id)).toEqual(['page-1']);
    expect(documentFromScene(scene).pages).toHaveLength(1);
  });
});
