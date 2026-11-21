import { describe, expect, it } from 'vitest';
import { INHERIT } from '@weasel-js/core';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';
import { svgNodesFromKit, type SvgKitTree } from './fromKit';
import { fitLeafXml } from './groupPaintXml';
import type { SvgPathNode } from './types';

const svg = (body: string): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`;

function drafts(body: string) {
  let n = 0;
  return svgNodesToKitDrafts(parseSvg(svg(body)), () => `d${++n}`);
}

const RECT = '<rect x="0" y="0" width="10" height="10"/>';

describe('importing a group’s paint', () => {
  it('gives the container the group’s fill and a child that sets none inherit', () => {
    const [g, leaf] = drafts(`<g fill="#ff0000">${RECT}</g>`);
    expect(g.kind).toBe('group');
    expect(g.data.fill).toMatchObject({ paint: { color: '#ff0000' } });
    expect(leaf.data).toMatchObject({ fill: INHERIT });
  });

  it('keeps a child’s own fill opacity as its own fill', () => {
    const [, leaf] = drafts(`<g fill="#ff0000"><rect width="10" height="10" fill-opacity="0.5"/></g>`);
    expect(leaf.data.fill).not.toBe(INHERIT);
    const parsed = parseSvg(svg(`<g fill="#ff0000"><g fill-opacity="0.5">${RECT}</g></g>`));
    const inner = (parsed.nodes[0] as { children: { inherits?: unknown }[] }).children[0];
    expect(inner.inherits).toBeUndefined();
    expect(serializeSvg(parseSvg(svg(`<g fill="#ff0000"><rect width="10" height="10" fill-opacity="0.5"/></g>`)).nodes))
      .toMatch(/<rect[^>]*fill-opacity="0.5"|<path[^>]*fill-opacity="0.5"/);
  });

  it('keeps a child’s own fill', () => {
    const [, leaf] = drafts(`<g fill="#ff0000"><rect width="10" height="10" fill="#0000ff"/></g>`);
    expect(leaf.data).toMatchObject({ fill: { paint: { color: '#0000ff' } } });
  });

  it('makes a group between them inherit too, so the chain reaches the source', () => {
    const [outer, inner, leaf] = drafts(`<g fill="#ff0000"><g>${RECT}</g></g>`);
    expect(outer.data.fill).toMatchObject({ paint: { color: '#ff0000' } });
    expect(inner.data.fill).toBe(INHERIT);
    expect(leaf.data).toMatchObject({ fill: INHERIT });
  });

  it('resolves a fill set on the root svg, which no container holds', () => {
    let n = 0;
    const [leaf] = svgNodesToKitDrafts(
      parseSvg(`<svg xmlns="http://www.w3.org/2000/svg" fill="#ff0000">${RECT}</svg>`), () => `d${++n}`,
    );
    expect(leaf.data).toMatchObject({ fill: { paint: { color: '#ff0000' } } });
  });

  it('takes a group’s stroke whole only when the child sets no stroke property', () => {
    const [g, takes, own] = drafts(
      `<g stroke="#000000" stroke-width="2">${RECT}<rect width="10" height="10" stroke-width="5"/></g>`,
    );
    expect(g.data.stroke).toMatchObject({ paint: { color: '#000000' }, width: 2 });
    expect(takes.data).toMatchObject({ stroke: INHERIT });
    expect(own.data).toMatchObject({ stroke: { paint: { color: '#000000' }, width: 5 } });
  });

  it('resolves a gradient onto each child rather than inheriting it', () => {
    const [, leaf] = drafts(
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>'
      + `<g fill="url(#g)">${RECT}</g>`,
    );
    expect((leaf.data as { fill?: unknown }).fill).not.toBe(INHERIT);
  });

  it('resolves a child faded further than its group', () => {
    const [, leaf] = drafts(`<g fill="#ff0000"><rect width="10" height="10" opacity="0.5"/></g>`);
    expect((leaf.data as { fill?: unknown }).fill).not.toBe(INHERIT);
  });
});

describe('exporting a container’s paint', () => {
  type N = { kind: string; data: unknown; pose: { x: number; y: number; width: number; height: number } };
  const box = { x: 0, y: 0, width: 10, height: 10 };
  const path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
  const tree = (group: unknown, children: Record<string, unknown>): SvgKitTree => {
    const nodes: Record<string, N> = { g: { kind: 'group', data: group, pose: box } };
    for (const [id, data] of Object.entries(children)) nodes[id] = { kind: 'mark', data: { path, ...(data as object) }, pose: box };
    return { roots: ['g'], childrenOf: (id) => (id === 'g' ? Object.keys(children) : []), get: (id) => nodes[id] };
  };
  const RED = { paint: { kind: 'solid', color: '#ff0000' } };

  it('writes the container’s fill on the group and none on a child that inherits it', () => {
    const out = serializeSvg(svgNodesFromKit(tree({ fill: RED }, { a: { fill: INHERIT } })));
    expect(out).toMatch(/<g [^>]*fill="#ff0000"/);
    expect(out).toMatch(/<path d="[^"]*"(?![^>]*\bfill=)[^>]*\/>/);
  });

  it('resets on a child that does not inherit what the group sets', () => {
    const group = { stroke: { paint: { kind: 'solid', color: '#000000' }, width: 2, dash: [4, 2] } };
    const out = serializeSvg(svgNodesFromKit(tree(group, {
      a: { stroke: { paint: { kind: 'solid', color: '#00ff00' }, width: 1 } },
    })));
    expect(out).toMatch(/<path [^>]*stroke-dasharray="none"/);
  });

  it('reads back as the same inheritance', () => {
    const out = serializeSvg(svgNodesFromKit(tree({ fill: RED }, { a: { fill: INHERIT }, b: { fill: { paint: { kind: 'solid', color: '#0000ff' } } } })));
    let n = 0;
    const [g, a, b] = svgNodesToKitDrafts(parseSvg(out), () => `d${++n}`);
    expect(g.data.fill).toEqual({ paint: { color: '#ff0000' } });
    expect(a.data).toMatchObject({ fill: INHERIT });
    expect(b.data).toMatchObject({ fill: { paint: { color: '#0000ff' } } });
  });
});

describe('fitLeafXml', () => {
  it('reads a start tag past a > inside a quoted attribute value', () => {
    const out = fitLeafXml('<path d="M0 0" inkscape:label="a > b"/>', undefined, new Set(['fill']));
    expect(out).toBe('<path d="M0 0" inkscape:label="a > b" fill="#000000"/>');
    expect(new DOMParser().parseFromString(`<svg xmlns:inkscape="x">${out}</svg>`, 'image/svg+xml')
      .getElementsByTagName('parsererror')).toHaveLength(0);
  });
});

describe('exporting a path drawn otherwise than its group’s stroke', () => {
  const stroke = { paint: { kind: 'solid' as const, color: '#000000' }, width: 1, markerEnd: { key: 'arrow' } };
  const red = { kind: 'solid' as const, color: '#ff0000' };
  const closed = (...subs: number[][]): SvgPathNode['path'] => {
    const commands: number[] = [];
    const coords: number[] = [];
    for (const sub of subs) {
      for (let i = 0; i < sub.length; i += 2) commands.push(i === 0 ? 0 : 1);
      commands.push(4);
      coords.push(...sub);
    }
    return { kind: 'polygon', commands, coords } as SvgPathNode['path'];
  };
  /** The markup after the marker definitions. */
  const inGroup = (path: SvgPathNode['path']) => {
    const out = serializeSvg([{
      kind: 'group', fill: red, stroke, children: [{ kind: 'path', path, fill: red, stroke, inherits: { fill: true, stroke: true } }],
    }]);
    return out.slice(out.indexOf('</defs>'));
  };

  it('keeps a closed path from taking the end marker the group sets', () => {
    const out = inGroup(closed([0, 0, 10, 0, 10, 10]));
    expect(out).toMatch(/<path [^>]*marker-end="none"/);
  });

  it('keeps the fill piece of a marked path from taking the group’s stroke', () => {
    const out = inGroup(closed([0, 0, 10, 0, 10, 10], [20, 0, 30, 0, 30, 10]));
    const first = out.match(/<path [^>]*>/)![0];
    expect(first).toContain('stroke="none"');
  });
});
