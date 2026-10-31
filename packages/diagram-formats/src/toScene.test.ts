import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY } from '@weasel-js/core';
import { DIAGRAM_THEMES, DIAGRAM_THEME_KEY, edgeIdOf, type DiagramEdge, type DiagramSpec } from '@weasel-js/diagram';
import type { DiagramDocument } from './document';
import { documentSpecs } from './toScene';
import { MEASURE } from './testing/docScene';
import { asGraph } from './testing/graphPages';

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

  it('writes the page list and the theme as document values', () => {
    const { doc } = documentSpecs(DOC);
    expect(doc[PAGES_DOC_KEY]).toEqual({ pages: [{ id: 'one', width: 400, height: 300 }, { id: 'two', name: 'Two', width: 400, height: 300 }] });
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
    const { specs, doc } = documentSpecs(graph(), { measure: MEASURE });
    const page = (doc[PAGES_DOC_KEY] as { pages: { width: number; height: number }[] }).pages[0]!;
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
