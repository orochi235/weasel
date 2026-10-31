import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, createScene, movePage, renamePage, type PagesDoc, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '@weasel-js/diagram';
import type { DiagramDocument, GraphPage } from './document';
import { documentFromScene } from './fromScene';
import { GRAPH_PAGE_META_KEY } from './graphPageMeta';
import { DIAGRAM_MERMAID } from './mermaid/format';
import { documentSpecs } from './toScene';
import { MEASURE } from './testing/docScene';

const fixture = (kind: string, file: string) =>
  readFileSync(join(__dirname, '__fixtures__', 'mermaid', kind, file), 'utf8');
const imported = (text: string) => (DIAGRAM_MERMAID.read!(text) as { document: DiagramDocument }).document;

function sceneOf(document: DiagramDocument) {
  const { specs, doc } = documentSpecs(document, { measure: MEASURE });
  return createScene<unknown, string, RectPose>({
    systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc, initial: specs as never,
  });
}

const settings = (page: GraphPage) => ({ notation: page.notation, layout: page.layout, direction: page.direction });

describe('a graph page\'s notation, layout, and direction through the scene', () => {
  const pages = [
    ['class', imported(fixture('class', 'shop.mmd')).pages[0] as GraphPage],
    ['block', imported(fixture('block', 'system.mmd')).pages[0] as GraphPage],
  ] as const;

  it.each(pages)('keeps a %s page\'s', (_kind, page) => {
    const back = documentFromScene(sceneOf({ pages: [page] })).pages[0] as GraphPage;
    expect(settings(back)).toEqual(settings(page));
  });

  it('keeps a block page\'s columns, spans, and skips', () => {
    const back = documentFromScene(sceneOf({ pages: [pages[1][1]] })).pages[0] as GraphPage;
    expect(back.layout?.options?.grid).toMatchObject({ columns: 3, spans: { services: 3, wide: 3 }, skips: { cache: 2 } });
  });

  it('writes nothing on a page that has none of them', () => {
    const scene = sceneOf({ pages: [{ kind: 'graph', id: 'p', width: 100, height: 100, data: { nodes: [], edges: [] } }] });
    expect((scene.doc.get(PAGES_DOC_KEY) as PagesDoc).pages[0]!.meta).toBeUndefined();
  });

  it('stays with its page when pages are reordered and renamed, and through undo', () => {
    const [, classPage] = pages[0];
    const [, blockPage] = pages[1];
    const scene = sceneOf({ pages: [{ ...classPage, id: 'c' }, { ...blockPage, id: 'b' }] });
    movePage(scene, 'b', 0);
    renamePage(scene, 'c', 'Classes');
    scene.undo();
    const back = documentFromScene(scene).pages as GraphPage[];
    expect(back.map((p) => [p.id, p.notation])).toEqual([['b', 'block'], ['c', 'class']]);
    expect((scene.doc.get(PAGES_DOC_KEY) as PagesDoc).pages[1]!.meta?.[GRAPH_PAGE_META_KEY]).toMatchObject({ notation: 'class' });
  });

  it('exports a class page read back from the scene as a class diagram', () => {
    const back = documentFromScene(sceneOf({ pages: [pages[0][1]] }));
    expect(DIAGRAM_MERMAID.write!(back).text.split('\n')).toContain('classDiagram');
  });
});
