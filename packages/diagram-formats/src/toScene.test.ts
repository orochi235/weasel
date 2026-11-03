import { describe, expect, it } from 'vitest';
import { DIAGRAM_THEMES, DIAGRAM_THEME_KEY, edgeIdOf, type DiagramEdge, type DiagramSpec } from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { pagesOf } from '@weasel-js/core';
import { addDocumentScene, documentSpecs } from './toScene';
import { MEASURE, contentNodes, drawnScene } from './testing/docScene';
import { asGraph } from './testing/asGraph';

const at = (specs: readonly DiagramSpec<string>[], id: string) => {
  const { x, y } = specs.find((s) => s.id === id)!.pose;
  return { x, y };
};
const boxOf = (specs: readonly DiagramSpec<string>[], id: string) => {
  const { x, y, width, height } = specs.find((s) => s.id === id)!.pose;
  return { x, y, width, height };
};
const edgeTrait = (specs: readonly DiagramSpec<string>[], id: string) => specs.find((s) => s.id === id)!.data.diagram as DiagramEdge;

const DOC: DiagramDocument = {
  pages: [
    { kind: 'graph',
      id: 'one', width: 400, height: 300,
      data: {
        nodes: [{ id: 'a', lines: ['A'], at: { x: 20, y: 30 } }, { id: 'b', lines: ['B'], at: { x: 200, y: 30 } }],
        edges: [{ id: 'ab', from: 'a', to: 'b', router: 'orthogonal', waypoints: [{ x: 150, y: 100 }] }],
        containers: [{ id: 'k', role: 'container', members: ['b'], box: { x: 180, y: 10, width: 150, height: 120 } }],
      },
    },
    { kind: 'graph', id: 'two', name: 'Two', width: 400, height: 300, data: { nodes: [{ id: 'c', lines: ['C'], at: { x: 50, y: 60 } }], edges: [] } },
  ],
  crossPageEdges: [{ id: 'ac', from: 'a', to: 'c' }],
  theme: 'paper',
};

describe('documentSpecs', () => {
  it('places each page with layoutPages and offsets what is on it by its place', () => {
    const { specs } = documentSpecs(DOC, { measure: MEASURE });
    expect(at(specs, 'a')).toEqual({ x: 20, y: 30 });
    // Page two starts past page one and the 40 gap.
    expect(at(specs, 'c')).toEqual({ x: 440 + 50, y: 60 });
  });

  it('moves boxes and waypoints with their page', () => {
    const moved: DiagramDocument = { pages: [{ ...asGraph(DOC.pages[1]!), data: { nodes: [] , edges: [] } }, DOC.pages[0]!] };
    const { specs } = documentSpecs(moved, { measure: MEASURE });
    expect(boxOf(specs, 'k')).toEqual({ x: 440 + 180, y: 10, width: 150, height: 120 });
    expect(edgeTrait(specs, 'ab').waypoints).toEqual([{ x: 440 + 150, y: 100 }]);
  });

  it('draws an edge between pages', () => {
    const { specs } = documentSpecs(DOC, { measure: MEASURE });
    expect(specs.find((s) => s.id === 'ac')?.dependsOn).toEqual(['a', 'c']);
  });

  it('lists the pages, and writes the theme as a document value', () => {
    const { pages, doc } = documentSpecs(DOC);
    expect(pages).toEqual([{ id: 'one', width: 400, height: 300 }, { id: 'two', name: 'Two', width: 400, height: 300 }]);
    expect(doc[DIAGRAM_THEME_KEY]).toBe('paper');
  });

  it('draws in the theme the document names, unless given one', () => {
    const paper = DIAGRAM_THEMES.paper!;
    const fill = (specs: readonly DiagramSpec<string>[]) => specs.find((s) => s.id === 'a')!.data.fill?.paint.color;
    expect(fill(documentSpecs(DOC).specs)).toBe(paper.roles[paper.defaultRole]!.fill);
    const night = DIAGRAM_THEMES.night!;
    const given = documentSpecs(DOC, { theme: night });
    expect(fill(given.specs)).toBe(night.roles[night.defaultRole]!.fill);
    expect(given.doc[DIAGRAM_THEME_KEY]).toBe('night');
  });

  it('puts every spec on the layer it is given', () => {
    expect(documentSpecs(DOC, { layer: 'shapes' }).specs.every((s) => s.layer === 'shapes')).toBe(true);
  });
});

describe('documentSpecs on a page with nodes that have no place', () => {
  const graph = (direction?: 'down' | 'right'): DiagramDocument => ({
    pages: [{ kind: 'graph',
      id: 'p', width: 300, height: 200, ...(direction ? { direction } : {}),
      data: {
        nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, lines: [`Node ${id}`] })),
        edges: [{ from: 'a', to: 'b', label: 'go' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }],
      },
    }],
  });

  it('lays the page out, inside its page, growing the page to hold it', () => {
    const { specs, pages } = documentSpecs(graph(), { measure: MEASURE });
    const page = pages[0]!;
    const boxes = ['a', 'b', 'c', 'd'].map((id) => boxOf(specs, id));
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.width);
      expect(b.y + b.height).toBeLessThanOrEqual(page.height);
    }
    expect(page.height).toBeGreaterThan(200);
    expect(boxes[0]!.y).toBeLessThan(boxes[1]!.y);
  });

  it('lays out the way the page says', () => {
    const { specs } = documentSpecs(graph('right'), { measure: MEASURE });
    expect(at(specs, 'a').x).toBeLessThan(at(specs, 'b').x);
  });

  it('keeps the route and label place layout chose', () => {
    const { specs } = documentSpecs(graph(), { measure: MEASURE });
    const id = edgeIdOf({ from: 'a', to: 'b', label: 'go' });
    expect(edgeTrait(specs, id).laidOut).toBeDefined();
    const label = specs.find((s) => s.id === `${id}/label`)!.data.diagram as { label: { at: unknown } };
    expect(typeof label.label.at).toBe('object');
  });

  it('leaves the nodes that have a place where they are', () => {
    const page = asGraph(graph().pages[0]!);
    const pinned: DiagramDocument = {
      pages: [{ ...page, data: { ...page.data, nodes: page.data.nodes.map((n) => (n.id === 'c' ? { ...n, at: { x: 500, y: 20 } } : n)) } }],
    };
    expect(at(documentSpecs(pinned, { measure: MEASURE }).specs, 'c')).toEqual({ x: 500, y: 20 });
  });
});

describe('addDocumentScene', () => {
  const SECOND: DiagramDocument = {
    pages: [{ kind: 'graph', id: 'one', name: 'Again', width: 500, height: 300, data: {
      nodes: [{ id: 'a', lines: ['Again'], at: { x: 60, y: 60 } }, { id: 'z', lines: ['Z'], at: { x: 200, y: 60 } }],
      edges: [{ id: 'az', from: 'a', to: 'z' }],
    } }],
  };

  it('replaces what the scene held, pages and connectors in the run too, as one undo entry', () => {
    const scene = drawnScene(documentSpecs(DOC, { measure: MEASURE }));
    const depth = scene.historyEntries().length;
    addDocumentScene(scene, documentSpecs(SECOND, { measure: MEASURE }), 'Import');
    expect(pagesOf(scene)!.pages.map((p) => [p.id, p.name, p.width])).toEqual([['one', 'Again', 500]]);
    const ids = contentNodes(scene).map((n) => n.id);
    for (const gone of ['b', 'c', 'k', 'ab', 'ac']) expect(ids).not.toContain(gone);
    expect(ids).toEqual(expect.arrayContaining(['a', 'z', 'az']));
    expect(scene.get('a' as never)!.parent).toBe('one');
    expect(scene.historyEntries().length).toBe(depth + 1);
    scene.undo();
    expect(pagesOf(scene)!.pages.map((p) => p.id)).toEqual(['one', 'two']);
    expect(contentNodes(scene).map((n) => n.id)).toEqual(expect.arrayContaining(['a', 'b', 'c', 'k', 'ab', 'ac']));
    expect(scene.get('z' as never)).toBeUndefined();
  });

  it('clears every document value the new document does not hold, and undo brings them back', () => {
    const scene = drawnScene(documentSpecs(DOC, { measure: MEASURE }));
    scene.doc.set('app:stale', 1);
    const second = documentSpecs(SECOND, { measure: MEASURE });
    addDocumentScene(scene, second, 'Import');
    expect(scene.doc.keys().sort()).toEqual(Object.keys(second.doc).sort());
    scene.undo();
    expect(scene.doc.get('app:stale')).toBe(1);
  });
});
