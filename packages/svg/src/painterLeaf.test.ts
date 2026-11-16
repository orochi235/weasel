import { afterEach, describe, expect, it } from 'vitest';
import { solid } from '@weasel-js/paint';
import { mat3, poseFrameOf, registerNodeShape, type DrawCommand } from '@weasel-js/core';
import { svgNodesFromKit, type SvgKitPose, type SvgKitTree, type SvgKitTreeNode } from './fromKit';
import { serializeSvg } from './serialize';
import { applyMatrix } from './transform';
import type { SvgGroupNode, SvgPathNode } from './types';

type CommandPaint = NonNullable<NonNullable<Extract<DrawCommand, { kind: 'path' }>['fill']>['paint']>;

const BOX: SvgKitPose ={ x: 10, y: 20, width: 40, height: 20 };

let release: (() => void)[] = [];
afterEach(() => {
  for (const r of release) r();
  release = [];
});

/** Registers a painter for nodes of kind `blob` that returns `cmds(pose)`. */
function paintBlobs(cmds: (pose: SvgKitPose) => DrawCommand[]): void {
  release.push(registerNodeShape<unknown, SvgKitPose>({
    id: 'test:blob',
    matches: (node) => (node.kind as string) === 'blob',
    paint: (_node, pose) => cmds(pose),
  }));
}

function treeOf(nodes: Record<string, SvgKitTreeNode>): SvgKitTree {
  return { roots: Object.keys(nodes), childrenOf: () => [], get: (id) => nodes[id] };
}

const blob = (pose: SvgKitPose = BOX): SvgKitTreeNode => ({ kind: 'blob', data: { blob: true }, pose });
const boxPath = (p: SvgKitPose) => ({ kind: 'rect' as const, x: p.x, y: p.y, width: p.width, height: p.height });

describe('svgNodesFromKit over a painter of the app own', () => {
  it('writes its solid-filled path commands with no leaf', () => {
    paintBlobs((p) => [{ kind: 'path', path: boxPath(p), fill: { paint: solid('#ff0000') } }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob() }));
    expect(out).toEqual({ kind: 'path', path: boxPath(BOX), fill: { kind: 'solid', color: '#ff0000' } });
    expect(serializeSvg([out!])).toContain('fill="#ff0000"');
  });

  it('carries the stroke: width, dash, caps, joins and opacity', () => {
    paintBlobs((p) => [{
      kind: 'path', path: boxPath(p),
      stroke: { paint: { ...solid('#0000ff'), opacity: 0.5 }, width: 3, dash: [4, 2], cap: 'round', join: 'bevel' },
    }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob() })) as SvgPathNode[];
    expect(out!.fill).toEqual({ kind: 'none' });
    expect(out!.stroke).toMatchObject({ width: 3, dash: [4, 2], cap: 'round', join: 'bevel', opacity: 0.5 });
    const xml = serializeSvg([out!]);
    for (const attr of ['stroke="#0000ff"', 'stroke-width="3"', 'stroke-dasharray="4 2"', 'stroke-linecap="round"', 'stroke-linejoin="bevel"']) {
      expect(xml).toContain(attr);
    }
  });

  it('writes a turned pose as a group carrying its frame, the commands as drawn inside', () => {
    const pose = { ...BOX, rotation: Math.PI / 2 };
    paintBlobs((p) => [{ kind: 'path', path: boxPath(p), fill: { paint: solid('#00ff00') } }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob(pose) })) as SvgGroupNode[];
    expect(out!.kind).toBe('group');
    expect(out!.transform).toEqual(poseFrameOf(pose));
    expect((out!.children[0] as SvgPathNode).path).toEqual(boxPath(pose));
  });

  it('keeps a local gradient in the frame its path is drawn in', () => {
    const pose = { ...BOX, rotation: Math.PI / 3 };
    const local: CommandPaint = {
      kind: 'linear-gradient', units: 'local', from: { x: 10, y: 20 }, to: { x: 50, y: 20 },
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    };
    paintBlobs((p) => [{ kind: 'path', path: boxPath(p), fill: { paint: local } }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob(pose) })) as SvgGroupNode[];
    expect((out!.children[0] as SvgPathNode).fill).toEqual({ kind: 'gradient', paint: local });
  });

  it('takes a world gradient back through the pose frame, so it lands where the canvas paints it', () => {
    const pose = { ...BOX, rotation: Math.PI / 3 };
    const world: CommandPaint = {
      kind: 'linear-gradient', units: 'world', from: { x: 0, y: 0 }, to: { x: 100, y: 0 },
      stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#ffffff' }],
    };
    paintBlobs((p) => [{ kind: 'path', path: boxPath(p), fill: { paint: world }, stroke: { paint: world, width: 2 } }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob(pose) })) as SvgGroupNode[];
    const path = out!.children[0] as SvgPathNode;
    for (const paint of [path.fill, path.stroke!.paint]) {
      if (paint.kind !== 'gradient' || paint.paint.kind !== 'linear-gradient') throw new Error('expected a linear gradient');
      expect(paint.paint.units).toBe('world');
      const from = applyMatrix(out!.transform!, paint.paint.from.x, paint.paint.from.y);
      const to = applyMatrix(out!.transform!, paint.paint.to.x, paint.paint.to.y);
      expect(from.x).toBeCloseTo(0); expect(from.y).toBeCloseTo(0);
      expect(to.x).toBeCloseTo(100); expect(to.y).toBeCloseTo(0);
    }
  });

  it('writes a group command with its transform, alpha and clip', () => {
    paintBlobs((p) => [{
      kind: 'group', transform: mat3.fromAffine([2, 0, 0, 2, 5, 6]), alpha: 0.5, clip: boxPath(p),
      children: [{ kind: 'path', path: boxPath(p), fill: { paint: solid('#123456') } }],
    }]);
    const [out] = svgNodesFromKit(treeOf({ a: blob() })) as SvgGroupNode[];
    expect(out).toMatchObject({ kind: 'group', transform: [2, 0, 0, 2, 5, 6], opacity: 0.5, clip: boxPath(BOX) });
    expect(out!.children).toHaveLength(1);
  });

  it('leaves out a text command, saying so once per kind', () => {
    paintBlobs((p) => [
      { kind: 'text', x: p.x, y: p.y, runs: [], style: {} },
      { kind: 'path', path: boxPath(p), fill: { paint: solid('#ff0000') } },
    ]);
    const warnings: string[] = [];
    const out = svgNodesFromKit(treeOf({ a: blob(), b: blob() }), { onWarn: (m) => warnings.push(m) });
    expect(out.map((n) => n.kind)).toEqual(['path', 'path']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/text draw command from painter test:blob/);
  });

  it('lets an explicit leaf win over the painter', () => {
    paintBlobs((p) => [{ kind: 'path', path: boxPath(p), fill: { paint: solid('#ff0000') } }]);
    const mine: SvgPathNode = { kind: 'path', path: boxPath(BOX), fill: { kind: 'solid', color: '#00ff00' } };
    expect(svgNodesFromKit(treeOf({ a: blob() }), { leaf: () => mine })).toEqual([mine]);
  });

  it('still writes a built-in kind from its data', () => {
    paintBlobs(() => []);
    const path = boxPath(BOX);
    const [out] = svgNodesFromKit(treeOf({ a: { kind: 'path', data: { path, fill: { paint: solid('#abcdef') } }, pose: BOX } }));
    expect(out).toMatchObject({ kind: 'path', fill: { kind: 'solid', color: '#abcdef' } });
  });
});
