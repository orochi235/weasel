import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY } from '@weasel-js/core';
import { DIAGRAM_TYPE_DOC_KEY, FLOWCHART_NOTATION, type DiagramTypeDoc } from '@weasel-js/diagram';
import type { DiagramDocument, GraphPage } from './document';
import { documentFromScene } from './fromScene';
import { GRAPH_PAGE_META_KEY } from './graphPageMeta';
import { DIAGRAM_MERMAID } from './mermaid/format';
import { documentSpecs } from './toScene';
import { authoredScene } from './testing/authoredScene';
import { MEASURE } from './testing/docScene';

const fixture = (kind: string, file: string) => readFileSync(join(__dirname, '__fixtures__', 'mermaid', kind, file), 'utf8');
const imported = (text: string) => (DIAGRAM_MERMAID.read!(text) as { document: DiagramDocument }).document;
const typeOf = (document: DiagramDocument) =>
  (documentSpecs(document, { measure: MEASURE }).doc[DIAGRAM_TYPE_DOC_KEY] as DiagramTypeDoc | undefined)?.type;

describe('a chart\'s diagram type and its pages\' notation', () => {
  it('writes a page authored as a UML class diagram in its notation', () => {
    const { scene } = authoredScene('umlClass', [{ stencil: 'uml-class', at: { x: 100, y: 100 } }]);
    expect((documentFromScene(scene).pages[0] as GraphPage).notation).toBe('class');
    expect(DIAGRAM_MERMAID.write!(documentFromScene(scene)).text).toMatch(/^classDiagram/m);
  });

  it('lets a page\'s own notation win over its chart\'s type', () => {
    const { scene } = authoredScene('umlClass');
    const pages = { pages: [{ id: 'p', width: 800, height: 600, meta: { [GRAPH_PAGE_META_KEY]: { notation: FLOWCHART_NOTATION } } }] };
    scene.batch('Pages', () => scene.doc.set(PAGES_DOC_KEY, pages));
    const page = documentFromScene(scene).pages[0] as GraphPage;
    expect(page.notation).toBeUndefined();
    expect(DIAGRAM_MERMAID.write!(documentFromScene(scene)).text).toMatch(/^flowchart/m);
  });

  it('leaves a flowchart\'s notation unset', () => {
    const { scene } = authoredScene('network');
    expect((documentFromScene(scene).pages[0] as GraphPage).notation).toBeUndefined();
  });

  it('opens an imported diagram as the type its notation names', () => {
    expect(typeOf(imported(fixture('class', 'shop.mmd')))).toBe('umlClass');
    expect(typeOf(imported(fixture('state', 'door.mmd')))).toBe('state');
    expect(typeOf(imported(fixture('c4', readdirSync(join(__dirname, '__fixtures__', 'mermaid', 'c4'))[0]!)))).toBe('c4');
    expect(typeOf(imported('flowchart LR\n  a --> b'))).toBe('flowchart');
  });

  it('names no type when graph pages disagree', () => {
    const cls = imported(fixture('class', 'shop.mmd')).pages[0]!;
    const flow = imported('flowchart LR\n  a --> b').pages[0]!;
    expect(typeOf({ pages: [{ ...cls, id: 'c' }, { ...flow, id: 'f' }] })).toBeUndefined();
  });
});
