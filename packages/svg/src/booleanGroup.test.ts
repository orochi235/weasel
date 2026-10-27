/**
 * A boolean group exports as the path it draws, with its children kept hidden
 * beside it for an import to rebuild it from.
 */
import { describe, expect, it } from 'vitest';
import { booleanGroupFields, boundsOfPath, createScene, pathContainsPoint, type Path, type RectPose } from '@weasel-js/core';
import { svgNodesFromKit, type SvgKitTree } from './fromKit';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import { svgNodesToKitDrafts } from './unpack';
import type { SvgGroupNode, SvgPathNode } from './types';

const RED = { paint: { kind: 'solid' as const, color: '#ff0000' } };
const rect = (x: number, y: number): Path => ({ kind: 'rect', x, y, width: 100, height: 100 });

/** A boolean group over a back square at (0, 0) and a front one at (50, 50). */
function makeScene(op: string) {
  const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const group = scene.add({
    ...booleanGroupFields<RectPose>(), layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { fill: RED, boolean: op },
  });
  for (const [x, y] of [[0, 0], [50, 50]] as const) {
    scene.add({ kind: 'mark', layer: 'main', parent: group, pose: { x, y, width: 100, height: 100 }, data: { path: rect(x, y), fill: RED } });
  }
  return scene;
}

const exported = (op: string) => svgNodesFromKit(makeScene(op) as unknown as SvgKitTree);

describe('a boolean group in SVG', () => {
  it('writes the path it draws, then its children hidden, marked with the operation', () => {
    const [g] = exported('subtract') as SvgGroupNode[];
    const [self, operands] = g!.children as [SvgPathNode, SvgGroupNode];
    expect(self.kind).toBe('path');
    expect(pathContainsPoint(self.path, 25, 25)).toBe(true);
    expect(pathContainsPoint(self.path, 75, 75)).toBe(false);
    expect(boundsOfPath(self.path)).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(operands).toMatchObject({ kind: 'group', boolean: 'subtract', hidden: true });
    expect(operands.children).toHaveLength(2);
    const xml = serializeSvg([g!]);
    expect(xml).toMatch(/<g[^>]*data-weasel-boolean="subtract"[^>]*display="none"|<g[^>]*display="none"[^>]*data-weasel-boolean="subtract"/);
  });

  it('reads back as the boolean group, its children shown, even without keepHidden', () => {
    const xml = serializeSvg(exported('intersect'));
    for (const keepHidden of [false, true]) {
      let n = 0;
      const drafts = svgNodesToKitDrafts(parseSvg(xml, { keepHidden }), () => `n${n++}`);
      expect(drafts.map((d) => [d.kind, d.parentId])).toEqual([['mark', null], ['mark', 'n0'], ['mark', 'n0']]);
      expect(drafts[0]).toMatchObject({ boolean: 'intersect' });
      expect(drafts.slice(1).every((d) => !d.hidden)).toBe(true);
    }
  });

  it('is read by another reader as the result alone: the operands are display="none"', () => {
    const parsed = parseSvg(serializeSvg(exported('union')));
    const [g] = parsed.nodes as SvgGroupNode[];
    expect(g!.children[1]).toMatchObject({ boolean: 'union', hidden: true });
  });
});
