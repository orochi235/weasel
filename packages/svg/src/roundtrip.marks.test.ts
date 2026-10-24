import { describe, expect, it } from 'vitest';
import type { Path } from '@weasel-js/geom';
import { svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';
import type { SvgGroupNode } from './types';

const NS = { x: 'https://example.com/x' };
const square: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const RED = { paint: { kind: 'solid' as const, color: '#ff0000' } };
const BLUE = { paint: { kind: 'solid' as const, color: '#0000ff' } };

const markOf = (extra: Partial<SvgKitTreeNode> = {}): SvgKitTreeNode =>
  ({ kind: 'mark', data: { path: square, fill: RED }, pose: { x: 0, y: 0, width: 10, height: 10 }, ...extra });
const kid: SvgKitTreeNode = {
  kind: 'mark', data: { path: { kind: 'rect', x: 0, y: 0, width: 4, height: 4 }, fill: BLUE }, pose: { x: 2, y: 2, width: 4, height: 4 },
};

function tree(nodes: Record<string, SvgKitTreeNode>, kids: Record<string, string[]>, roots = ['p']): SvgKitTree {
  return { roots, childrenOf: (id) => kids[id] ?? [], get: (id) => nodes[id] };
}

const tag = (g: SvgGroupNode): SvgGroupNode => ({ ...g, meta: { x: { attrs: { role: 'mark' } } } });
const tagged = (g: SvgGroupNode): boolean => g.meta?.x?.attrs?.role === 'mark';

/** Export `t` with marks tagged, then read it back the same way. */
function roundTrip(t: SvgKitTree) {
  const svg = serializeSvg(svgNodesFromKit(t, { mark: (_id, g) => tag(g) }), { namespaces: NS });
  let n = 0;
  return svgNodesToKitDrafts(parseSvg(svg, { namespaces: NS, keepHidden: true }), () => `n${n++}`, { mark: tagged });
}

describe('a mark with children through svgNodesFromKit and back', () => {
  it('comes back a mark, holding its own paint, with its children under it', () => {
    const drafts = roundTrip(tree({ p: markOf(), a: kid, b: kid }, { p: ['a', 'b'] }));
    expect(drafts.map((d) => d.kind)).toEqual(['mark', 'mark', 'mark']);
    const [mark, a, b] = drafts;
    expect(mark!.parentId).toBeNull();
    expect([a!.parentId, b!.parentId]).toEqual([mark!.id, mark!.id]);
    expect(mark!.data).toMatchObject({ path: square, fill: { paint: { color: '#ff0000' } } });
    expect(a!.data).toMatchObject({ fill: { paint: { color: '#0000ff' } } });
  });

  it('keeps the clip it declares', () => {
    const drafts = roundTrip(tree({ p: markOf({ clip: 'outline' }), a: kid }, { p: ['a'] }));
    expect(drafts.map((d) => [d.kind, d.parentId])).toEqual([['mark', null], ['mark', drafts[0]!.id]]);
    expect(drafts[0]).toMatchObject({ clip: 'outline' });
    expect(drafts[1]).not.toHaveProperty('clip');
  });

  it('keeps it hidden', () => {
    const drafts = roundTrip(tree({ p: markOf({ hidden: true }), a: kid }, { p: ['a'] }));
    expect(drafts[0]).toMatchObject({ kind: 'mark', hidden: true });
  });

  it('nests under a group as a mark', () => {
    const group: SvgKitTreeNode = { kind: 'group', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } };
    const drafts = roundTrip(tree({ g: group, p: markOf(), a: kid }, { g: ['p'], p: ['a'] }, ['g']));
    expect(drafts.map((d) => d.kind)).toEqual(['group', 'mark', 'mark']);
    expect(drafts.map((d) => d.parentId)).toEqual([null, drafts[0]!.id, drafts[1]!.id]);
  });

  it('keeps the clip of a mark with copies, its children directly under it', () => {
    const p = markOf({ clip: 'outline', copiesFromPose: () => [[1, 0, 0, 1, 20, 0]] });
    const drafts = roundTrip(tree({ p, a: kid }, { p: ['a'] }));
    const [mark, a] = drafts;
    expect(mark).toMatchObject({ kind: 'mark', clip: 'outline', parentId: null });
    expect(a).toMatchObject({ kind: 'mark', parentId: mark!.id });
    // The copy is baked as for a group: a transformed group, under the mark, of a clipped group of the children.
    const [copy, clipped, copied] = drafts.slice(2);
    expect([copy, clipped, copied].map((d) => d?.kind)).toEqual(['group', 'group', 'mark']);
    expect([copy!.parentId, clipped!.parentId, copied!.parentId]).toEqual([mark!.id, copy!.id, clipped!.id]);
    expect(clipped).toMatchObject({ clip: 'outline' });
  });

  it('writes a mark whose children are all left out as its own element in the <g>, and reads it back childless', () => {
    const t = tree({ p: markOf(), a: kid }, { p: ['a'] });
    const nodes = svgNodesFromKit(t, { mark: (_id, g) => tag(g), include: (id) => id !== 'a' }) as SvgGroupNode[];
    expect(nodes[0]!.children.map((c) => c.kind)).toEqual(['path']);
    let n = 0;
    const svg = serializeSvg(nodes, { namespaces: NS });
    expect(svg).not.toMatch(/<g><\/g>|<g\/>/);
    const drafts = svgNodesToKitDrafts(parseSvg(svg, { namespaces: NS }), () => `n${n++}`, { mark: tagged });
    expect(drafts.map((d) => [d.kind, d.parentId])).toEqual([['mark', null]]);
  });
});

describe('reading a claimed <g>', () => {
  const read = (body: string) => {
    let n = 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="${NS.x}" viewBox="0 0 100 100">${body}</svg>`;
    return svgNodesToKitDrafts(parseSvg(svg, { namespaces: NS, keepHidden: true }), () => `n${n++}`, { mark: tagged });
  };
  const OWN = '<rect width="10" height="10" fill="#ff0000"/>';
  const KIDS = '<rect x="2" y="2" width="4" height="4" fill="#0000ff"/><rect x="6" y="2" width="4" height="4"/>';

  it('applies a clip on the claimed <g> as a plain group\'s would: a clipping group around the mark', () => {
    const drafts = read('<clipPath id="c"><rect width="5" height="5"/></clipPath>'
      + `<g x:role="mark" clip-path="url(#c)">${OWN}<g>${KIDS}</g></g>`);
    expect(drafts.map((d) => d.kind)).toEqual(['group', 'mark', 'mark', 'mark']);
    const [group, mark] = drafts;
    expect(group).toMatchObject({ clip: 'outline', parentId: null, data: { path: { kind: 'rect', width: 5, height: 5 }, fill: null } });
    expect(mark).toMatchObject({ parentId: group!.id, data: { fill: { paint: { color: '#ff0000' } } } });
    expect(mark).not.toHaveProperty('clip');
    expect(drafts.slice(2).every((d) => d.parentId === mark!.id)).toBe(true);
  });

  it('hides the children of a hidden inner <g>, not the mark', () => {
    const drafts = read(`<g x:role="mark">${OWN}<g display="none">${KIDS}</g></g>`);
    expect(drafts.map((d) => [d.kind, d.hidden === true])).toEqual([['mark', false], ['mark', true], ['mark', true]]);
  });
});

describe('a <g> the predicate does not claim', () => {
  it('reads as a group, as before', () => {
    const svg = serializeSvg(svgNodesFromKit(tree({ p: markOf(), a: kid }, { p: ['a'] }), { mark: (_id, g) => tag(g) }), { namespaces: NS });
    let n = 0;
    const drafts = svgNodesToKitDrafts(parseSvg(svg, { namespaces: NS }), () => `n${n++}`);
    expect(drafts[0]!.kind).toBe('group');
  });
});
