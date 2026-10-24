import { describe, expect, it } from 'vitest';
import { boundsOfPath, findShapeSilhouette, type IngestCtx, type Op, type Path } from '@weasel-js/core';
import { parseSvg } from './parse';
import { svgNodesFromKit, type SvgKitTree } from './fromKit';
import { svgNodesToKitDrafts, unpackSvgFiles } from './unpack';
import type { SvgGroupNode } from './types';

const CLIPPED = `<svg xmlns="http://www.w3.org/2000/svg">
  <clipPath id="c"><rect x="10" y="10" width="20" height="40"/></clipPath>
  <g clip-path="url(#c)"><rect width="100" height="100" fill="#ff0000"/></g>
</svg>`;

type Inserted = {
  id: string; kind: string; clip?: string; pose: { x: number; y: number; width: number; height: number };
  data: Record<string, unknown>;
};

async function unpacked(svg: string): Promise<Inserted[]> {
  let minted = 0;
  const nodes: Inserted[] = [];
  const c = {
    point: { x: 400, y: 300 },
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    applyOps: (ops: Op[]) => nodes.push(...ops.map((op) => (op.args as { node: Inserted }).node)),
    scene: { layers: [{ id: 'main' }], mintId: () => `svg-${minted++}` },
  } as unknown as IngestCtx;
  await unpackSvgFiles([new File([svg], 'a.svg', { type: 'image/svg+xml' })], c);
  return nodes;
}

describe('a clipped <g>', () => {
  it('drafts a group declaring the clip and carrying it, boxed by it', () => {
    let n = 0;
    const [group, leaf] = svgNodesToKitDrafts(parseSvg(CLIPPED), () => `n${n++}`);
    if (group.kind !== 'group') throw new Error('expected a group');
    expect(group.clip).toBe('outline');
    expect(group.data).toEqual({ path: { kind: 'rect', x: 10, y: 10, width: 20, height: 40 }, fill: null });
    expect(group.pose).toEqual({ x: 10, y: 10, width: 20, height: 40 });
    expect(leaf.pose).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('leaves an unclipped group boxed by its children, with no clip', () => {
    let n = 0;
    const [group] = svgNodesToKitDrafts(
      parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="100" height="100"/></g></svg>'),
      () => `n${n++}`,
    );
    expect(group).toEqual({
      kind: 'group', id: 'n0', parentId: null, pose: { x: 0, y: 0, width: 100, height: 100 }, data: {},
    });
  });

  it('unpacks to a group that declares its clip, paints nothing, and whose silhouette is the clip', async () => {
    const [group] = await unpacked(CLIPPED);
    expect(group.kind).toBe('group');
    expect(group.clip).toBe('outline');
    expect(group.data.fill).toBeNull();
    expect(group.data.stroke).toBeUndefined();
    // Centered on the drop point: the clip's 20 x 40 box, not the child's 100 x 100.
    expect(group.pose).toEqual({ x: 390, y: 280, width: 20, height: 40 });
    const silhouette = findShapeSilhouette(group as never, group.pose) as Path;
    expect(boundsOfPath(silhouette)).toMatchObject(group.pose);
  });

  it('writes a group declaring a clip back as a clipped group, and one only holding a path as unclipped', () => {
    const clip: Path = { kind: 'rect', x: 0, y: 0, width: 2, height: 4 };
    const nodes: Record<string, { kind: string; clip?: 'outline'; data: unknown; pose: { x: number; y: number; width: number; height: number } }> = {
      g: { kind: 'group', clip: 'outline', data: { path: clip, fill: null }, pose: { x: 10, y: 10, width: 20, height: 40 } },
      outlineOnly: { kind: 'group', data: { path: clip, fill: null }, pose: { x: 10, y: 10, width: 20, height: 40 } },
      a: { kind: 'path', data: { path: { kind: 'rect', x: 0, y: 0, width: 100, height: 100 } }, pose: { x: 0, y: 0, width: 100, height: 100 } },
      plain: { kind: 'group', data: {}, pose: { x: 0, y: 0, width: 1, height: 1 } },
    };
    const tree: SvgKitTree = {
      roots: ['g', 'outlineOnly', 'plain'],
      childrenOf: (id) => (id === 'g' || id === 'outlineOnly' ? ['a'] : []),
      get: (id) => nodes[id],
    };
    const [g, outlineOnly, plain] = svgNodesFromKit(tree) as SvgGroupNode[];
    expect(g.clip && boundsOfPath(g.clip)).toMatchObject({ x: 10, y: 10, width: 20, height: 40 });
    expect(outlineOnly.clip).toBeUndefined();
    expect(plain.clip).toBeUndefined();
  });
});
