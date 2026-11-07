import { describe, expect, it } from 'vitest';
import { boundsOfPath, pathFromD, type Path } from '@weasel-js/core';
import { svgNodesToKitDrafts } from './unpack';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgNode } from './types';

const INK = { kind: 'solid' as const, color: '#000' };
const square: SvgNode = { kind: 'path', path: pathFromD('M0 0H10V10H0Z'), fill: INK, stroke: { paint: INK, width: 1 } };

let n = 0;
const drafts = (nodes: SvgNode[]) => svgNodesToKitDrafts(nodes, () => `d${n++}`);
const box = (p: unknown) => {
  const b = boundsOfPath(p as Path);
  return [b.x, b.y, b.width, b.height].map((v) => Math.round(v * 1e6) / 1e6);
};

describe('svgNodesToKitDrafts under a group transform', () => {
  it('moves and scales a path, and its stroke width with it', () => {
    const [, leaf] = drafts([{ kind: 'group', transform: [2, 0, 0, 2, 5, 0], children: [square] }]);
    const data = leaf!.data as { path: Path; stroke: { width: number } };
    expect(box(data.path)).toEqual([5, 0, 20, 20]);
    expect(data.stroke.width).toBe(2);
  });

  it('composes nested transforms and carries a clip with its group', () => {
    const clip = pathFromD('M0 0H5V5H0Z');
    const out = drafts([{
      kind: 'group', transform: [1, 0, 0, 1, 100, 0],
      children: [{ kind: 'group', transform: [1, 0, 0, 1, 0, 50], clip, children: [square] }],
    }]);
    const clipped = out.find((d) => d.kind === 'group' && d.clip === 'outline')!;
    expect(box((clipped.data as { path: Path }).path)).toEqual([100, 50, 5, 5]);
    const leaf = out.find((d) => d.kind === 'mark')!;
    expect(box((leaf.data as { path: Path }).path)).toEqual([100, 50, 10, 10]);
  });

  it('places a text box and an image box', () => {
    const out = drafts([{
      kind: 'group', transform: [1, 0, 0, 1, 7, 3],
      children: [
        { kind: 'text', x: 0, y: 0, width: 20, height: 10, text: 'a' },
        { kind: 'image', href: 'a.png', x: 1, y: 1, width: 4, height: 4 },
      ],
    }]);
    const marks = out.filter((d) => d.kind === 'mark');
    expect(marks.map((d) => [d.pose.x, d.pose.y])).toEqual([[7, 3], [8, 4]]);
  });

  it('drafts what parsing its own export drafts', () => {
    const nodes: SvgNode[] = [{ kind: 'group', transform: [0, 1, -1, 0, 30, 0], children: [square] }];
    const direct = drafts(nodes).find((d) => d.kind === 'mark')!;
    const viaSvg = svgNodesToKitDrafts(parseSvg(serializeSvg(nodes)), () => 'x').find((d) => d.kind === 'mark')!;
    expect(box((direct.data as { path: Path }).path)).toEqual(box((viaSvg.data as { path: Path }).path));
  });
});
