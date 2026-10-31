import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DataContainer, DataEdge, DataNode } from '@weasel-js/diagram';
import type { DiagramDocument } from '../document';
import { DRAW_XML } from './format';
import { outlineOf } from './readStyle';
import { parseStyle } from './style';
import { asGraph } from '../testing/asGraph';

const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8');
const read = (text: string) => Promise.resolve(DRAW_XML.read!(text));

const nodes = (doc: DiagramDocument, page = 0): Map<string, DataNode> => new Map(doc.pages.map(asGraph)[page]!.data.nodes.map((n) => [n.id, n]));
const edges = (doc: DiagramDocument, page = 0): Map<string, DataEdge> => new Map(doc.pages.map(asGraph)[page]!.data.edges.map((e) => [e.id!, e]));
const regions = (doc: DiagramDocument, page = 0): Map<string, DataContainer> =>
  new Map((doc.pages.map(asGraph)[page]!.data.containers ?? []).map((c) => [c.id, c]));

describe('detecting draw-style XML', () => {
  it('knows the file by its root element', () => {
    expect(DRAW_XML.detect(fixture('flow.xml'))).toBe(true);
    expect(DRAW_XML.detect(fixture('model.xml'))).toBe(true);
    expect(DRAW_XML.detect('<!-- a note -->\n<mxfile><diagram/></mxfile>')).toBe(true);
  });

  it('turns down other XML and other text', () => {
    expect(DRAW_XML.detect('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')).toBe(false);
    expect(DRAW_XML.detect('{"format":"weasel-diagram"}')).toBe(false);
    expect(DRAW_XML.detect('digraph { a -> b }')).toBe(false);
  });
});

describe('reading a file of pages', () => {
  let doc: DiagramDocument;
  let warnings: readonly string[];
  beforeAll(async () => {
    ({ document: doc, warnings } = await read(fixture('flow.xml')));
  });

  it('reads one page per diagram element, with its name and size', () => {
    expect(doc.pages.map(asGraph).map(({ id, name, width, height }) => ({ id, name, width, height }))).toEqual([
      { id: 'flow-page', name: 'Flow', width: 850, height: 1100 },
      { id: 'lanes-page', name: 'Lanes', width: 1169, height: 827 },
    ]);
  });

  it('reads each outline, and draws a shape it does not know as a rect, with a warning', () => {
    const outlines = Object.fromEntries([...nodes(doc)].map(([id, n]) => [id, n.outline]));
    expect(outlines).toMatchObject({
      start: 'stadium', check: 'diamond', done: 'ellipse', prep: 'hexagon', io: 'parallelogram', manual: 'trapezoid', db: 'cylinder',
      inner: 'rect',
    });
    const seen: string[] = [];
    expect(outlineOf(parseStyle('shape=mxgraph.basic.star;'), (w) => seen.push(w))).toBe('rect');
    expect(seen.some((w) => w.includes('mxgraph.basic.star'))).toBe(true);
  });

  it('reads geometry as places and sizes on the page', () => {
    expect(nodes(doc).get('check')).toMatchObject({ at: { x: 40, y: 140 }, width: 120, height: 80 });
  });

  it('reads colors and font', () => {
    expect(nodes(doc).get('start')!.colors).toEqual({ fill: '#d5e8d4', stroke: '#82b366', text: '#333333' });
    expect(nodes(doc).get('check')!.colors).toBeUndefined();
    expect(nodes(doc).get('done')!.rows).toEqual([{ kind: 'label', text: 'Done', style: { fontSize: 16, fontFamily: 'Georgia', bold: true } }]);
  });

  it('reads HTML text with its tags stripped and its breaks kept', () => {
    expect(nodes(doc).get('check')!.lines).toEqual(['Is it', 'ready?']);
  });

  it('reads a wrapped cell by the id and label on its wrapper', () => {
    expect(nodes(doc).get('linked')).toMatchObject({ lines: ['Linked'], at: { x: 620, y: 300 } });
  });

  it('reads each edge style as a router', () => {
    const routers = Object.fromEntries([...edges(doc)].map(([id, e]) => [id, e.router]));
    expect(routers).toEqual({ e1: 'orthogonal', e2: 'orthogonal', e3: 'bezier', e4: 'straight' });
  });

  it('reads waypoints, in page coordinates whatever the edge\'s parent', () => {
    expect(edges(doc).get('e2')!.waypoints).toEqual([{ x: 200, y: 180 }]);
    expect(edges(doc, 1).get('e6')!.waypoints).toEqual([{ x: 140, y: 140 }]);
    expect(edges(doc).get('e1')!.waypoints).toBeUndefined();
  });

  it('reads exit and entry points as the nearest compass ports', () => {
    expect(edges(doc).get('e1')).toMatchObject({ from: 'start', to: 'check', fromPort: 's', toPort: 'n' });
  });

  it('reads labels from the edge or from a label cell on it, with where along it they sit', () => {
    expect(edges(doc).get('e2')).toMatchObject({ label: 'yes', labelPlacement: { at: 0.25, offset: 10 } });
    expect(edges(doc).get('e4')).toMatchObject({ label: 'back', labelPlacement: { at: 0.75 } });
  });

  it('reads an edge\'s stroke, label color, and markers', () => {
    expect(edges(doc).get('e2')!.colors).toEqual({ stroke: '#b85450', label: '#b85450', width: 2, dash: [3, 3] });
    expect(edges(doc).get('e3')!.colors).toEqual({ markerEnd: 'arrow-open' });
    expect(edges(doc).get('e4')!.colors).toEqual({ markerStart: 'arrow', markerEnd: null });
  });

  it('leaves out an edge with a loose end, with a warning', () => {
    expect(edges(doc).has('loose')).toBe(false);
    expect(warnings.some((w) => /loose end/.test(w))).toBe(true);
  });

  it('reads a container and its members, whose places are on the page', () => {
    expect(regions(doc).get('box')).toEqual({
      id: 'box', role: 'container', label: 'Box', members: ['inner'], box: { x: 40, y: 300, width: 300, height: 200 },
    });
    expect(nodes(doc).get('inner')!.at).toEqual({ x: 60, y: 360 });
    expect(regions(doc, 1).get('team')).toMatchObject({ role: 'container', label: 'Team', members: ['member'] });
    expect(nodes(doc, 1).get('member')!.at).toEqual({ x: 620, y: 90 });
  });

  it('reads a swimlane of swimlanes as a pool of lanes', () => {
    expect(regions(doc, 1).get('pool')).toEqual({
      id: 'pool', role: 'pool', label: 'Pool', axis: 'y', box: { x: 40, y: 40, width: 480, height: 240 },
      lanes: [
        { id: 'lane1', label: 'Lane 1', size: 120, members: ['task'] },
        { id: 'lane2', label: 'Lane 2', size: 120, members: ['lanes-page:start'] },
      ],
    });
    expect(nodes(doc, 1).get('task')!.at).toEqual({ x: 120, y: 70 });
    expect(nodes(doc, 1).get('task')!.outline).toBe('roundRect');
  });

  it('reads a group cell as a group of what it holds', () => {
    expect(doc.pages.map(asGraph)[0]!.data.groups).toEqual([{ id: 'grp', members: ['g1', 'g2'] }]);
    expect(nodes(doc).get('g2')!.at).toEqual({ x: 560, y: 300 });
  });

  it('renames a cell whose id an earlier page already used', () => {
    expect(nodes(doc, 1).get('lanes-page:start')!.lines).toEqual(['Begin']);
    expect(edges(doc, 1).get('e5')!.from).toBe('lanes-page:start');
  });
});

describe('reading other shapes of file', () => {
  it('reads a compressed page', async () => {
    const { document: doc } = await read(fixture('packed.xml'));
    expect(doc.pages).toHaveLength(1);
    expect(doc.pages.map(asGraph)[0]).toMatchObject({ id: 'packed-page', name: 'Packed', width: 600, height: 400 });
    expect(nodes(doc).get('ask')).toMatchObject({ outline: 'diamond', colors: { fill: '#fff2cc' }, at: { x: 40, y: 40 } });
    expect(nodes(doc).get('end')!.lines).toEqual(['End & more']);
    expect(edges(doc).get('go')).toMatchObject({ from: 'ask', to: 'end', router: 'orthogonal', label: 'go' });
  });

  it('reads a bare graph model as one page, merging its layers, with a warning', async () => {
    const { document: doc, warnings } = await read(fixture('model.xml'));
    expect(doc.pages).toHaveLength(1);
    expect([...nodes(doc).keys()]).toEqual(['a', 'b']);
    expect(edges(doc).get('ab')).toMatchObject({ from: 'a', to: 'b' });
    expect(warnings.some((w) => /2 layers/.test(w))).toBe(true);
  });

  it('moves what sits left of or above the page onto it, and sizes the page to hold it', async () => {
    const { document: doc } = await read(fixture('model.xml'));
    expect(nodes(doc).get('a')!.at).toEqual({ x: 40, y: 20 });
    expect(nodes(doc).get('b')!.at).toEqual({ x: 340, y: 20 });
    expect(doc.pages.map(asGraph)[0]!.width).toBe(340 + 80 + 40);
  });

  it('draws a text cell with no fill or stroke', async () => {
    const { document: doc } = await read(fixture('model.xml'));
    expect(nodes(doc).get('b')!.colors).toEqual({ fill: 'transparent', stroke: 'transparent' });
  });
});

describe('reading malformed files', () => {
  it('rejects text that is not well-formed XML', async () => {
    await expect(read('<mxfile><diagram></mxfile>')).rejects.toThrow(/not well-formed/);
  });

  it('rejects XML whose root is something else', async () => {
    await expect(read('<svg/>')).rejects.toThrow(/root element/);
  });

  it('rejects a file with no pages', async () => {
    await expect(read('<mxfile></mxfile>')).rejects.toThrow(/no pages/);
  });

  it('rejects a page whose compressed content does not inflate', async () => {
    await expect(read('<mxfile><diagram name="Bad">not*base64!</diagram></mxfile>')).rejects.toThrow(/"Bad".*compressed/);
  });

  it('rejects a page with neither a graph model nor content', async () => {
    await expect(read('<mxfile><diagram name="Empty"></diagram></mxfile>')).rejects.toThrow(/"Empty"/);
  });
});
