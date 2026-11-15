import { describe, expect, it } from 'vitest';
import { boundsOfPath, solid } from '@weasel-js/core';
import { svgNodesFromKit, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';
import type { SvgGroupNode, SvgPathNode } from './types';

const BOX = { x: 10, y: 20, width: 200, height: 100 };
const BG = { paint: solid('#fbf7ee') };
const BORDER = { paint: solid('#d4c4a8'), width: 2 };
const KID: SvgKitTreeNode = {
  kind: 'mark', data: { path: { kind: 'rect', x: 30, y: 40, width: 20, height: 20 }, fill: { paint: solid('#7fb069') } },
  pose: { x: 30, y: 40, width: 20, height: 20 },
};

function treeOf(group: Partial<SvgKitTreeNode>): SvgKitTree {
  const nodes: Record<string, SvgKitTreeNode> = { g: { kind: 'group', pose: BOX, data: {}, ...group }, kid: KID };
  return { roots: ['g'], childrenOf: (id) => (id === 'g' ? ['kid'] : []), get: (id) => nodes[id] };
}

function throughFile(group: Partial<SvgKitTreeNode>) {
  const svg = serializeSvg(svgNodesFromKit(treeOf(group)));
  let n = 0;
  return { svg, drafts: svgNodesToKitDrafts(parseSvg(svg), () => `n${n++}`) };
}

describe('a group that paints its box', () => {
  it('is written as a marked <g> holding its box, then its content', () => {
    const [g] = svgNodesFromKit(treeOf({ data: { background: BG, border: BORDER } })) as SvgGroupNode[];
    expect(g!.groupBox).toBe(true);
    const [box, content] = g!.children as [SvgPathNode, SvgGroupNode];
    expect(boundsOfPath(box.path)).toMatchObject(BOX);
    expect(box.fill).toMatchObject({ kind: 'solid', color: '#fbf7ee' });
    expect(box.stroke).toMatchObject({ width: 2 });
    expect(content.kind).toBe('group');
    expect(content.children).toHaveLength(1);
  });

  it('reads back as one group with its background, border, and box, holding its children', () => {
    const { svg, drafts } = throughFile({ data: { background: BG, border: BORDER } });
    expect(svg).toContain('data-weasel-group-box="true"');
    expect(drafts).toHaveLength(2);
    const [group, kid] = drafts;
    expect(group).toMatchObject({ kind: 'group', pose: BOX, data: { background: { paint: { color: '#fbf7ee' } }, border: { width: 2 } } });
    expect(group!.data).not.toHaveProperty('fill');
    expect(kid).toMatchObject({ kind: 'mark', parentId: group!.id });
  });

  it('keeps its clip on its content, so the clip does not cut its border', () => {
    const [g] = svgNodesFromKit(treeOf({ clip: 'outline', data: { background: BG, border: BORDER } })) as SvgGroupNode[];
    expect(g!.clip).toBeUndefined();
    expect((g!.children[1] as SvgGroupNode).clip).toBeDefined();
    const { drafts } = throughFile({ clip: 'outline', data: { background: BG, border: BORDER } });
    expect(drafts[0]).toMatchObject({ kind: 'group', clip: 'outline', pose: BOX });
  });

  it('keeps the paint its children inherit apart from its box', () => {
    const { drafts } = throughFile({ data: { border: BORDER, fill: { paint: solid('#123456') } } });
    expect(drafts[0]!.data).toMatchObject({ border: { width: 2 }, fill: { paint: { color: '#123456' } } });
    expect(drafts[0]!.data).not.toHaveProperty('background');
  });

  it('is kept with no children', () => {
    const tree: SvgKitTree = { roots: ['g'], childrenOf: () => [], get: () => ({ kind: 'group', pose: BOX, data: { background: BG } }) };
    const drafts = svgNodesToKitDrafts(parseSvg(serializeSvg(svgNodesFromKit(tree))), String);
    expect(drafts).toEqual([expect.objectContaining({ kind: 'group', pose: BOX })]);
  });

  it('reads a marked <g> something has since edited as the group it now is', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><g data-weasel-group-box="true">'
      + '<rect x="0" y="0" width="10" height="10" fill="#fff"/><rect x="20" y="0" width="10" height="10"/><rect x="40" y="0" width="10" height="10"/></g></svg>';
    const drafts = svgNodesToKitDrafts(parseSvg(svg), String);
    expect(drafts.filter((d) => d.kind === 'mark')).toHaveLength(3);
    expect(drafts[0]!.data).not.toHaveProperty('background');
  });

  it('writes an unpainted group as a plain <g>', () => {
    const [g] = svgNodesFromKit(treeOf({})) as SvgGroupNode[];
    expect(g!.groupBox).toBeUndefined();
    expect(g!.children).toHaveLength(1);
  });
});
