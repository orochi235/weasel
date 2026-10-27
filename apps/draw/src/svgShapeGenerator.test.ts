import { describe, expect, it } from 'vitest';
import { parseSvg } from '@weasel-js/svg';
import {
  IDENTITY_POSE_COMPOSITION,
  regenerateShape,
  shapeGeneratorOf,
  solid,
  starPath,
  type ShapeGenerator,
  layoutPages,
} from '@weasel-js/core';
import { svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';
import { leafOfObj } from './svgImport';
import { sceneToSvgString } from './svgExport';

const PAGE = { filename: 'page', pages: layoutPages([{ id: 'page-1', width: 200, height: 200 }]), backgroundColor: '#ffffff' } as const;
const STAR: ShapeGenerator = { kind: 'star', points: 6, innerRadiusRatio: 0.4, rotation: 0.25 };

function sceneOf(data: Record<string, unknown>) {
  const node = { id: 's', kind: 'mark', layer: 'default', parent: null, pose: { x: 20, y: 30, width: 100, height: 100, rotation: 0.5 }, data };
  return {
    roots: ['s'],
    composition: IDENTITY_POSE_COMPOSITION,
    get: (id: string) => (id === 's' ? node : undefined),
    childrenOf: () => [],
  } as never;
}

async function roundTrip(svg: string) {
  let n = 0;
  const drafts = svgNodesToSceneDrafts(parseSvg(svg, { namespaces: SWILL_NAMESPACES }), () => `n${n++}`);
  if (drafts[0]?.kind !== 'mark') throw new Error('expected a leaf');
  return leafOfObj(drafts[0].obj);
}

describe('a star saved to SVG and opened again', () => {
  const data = { path: starPath({ x: 0, y: 0 }, 50, 6, 20, 0.25), generator: STAR, fill: { paint: solid('#ff0000') } };

  it('keeps its parameters under the wd: namespace', async () => {
    const svg = await sceneToSvgString(sceneOf(data), PAGE);
    expect(svg).toContain('wd:tool="star"');
    const leaf = await roundTrip(svg);
    expect(shapeGeneratorOf(leaf.data)).toEqual(STAR);
  });

  it('can still be made again from them', async () => {
    const leaf = await roundTrip(await sceneToSvgString(sceneOf(data), PAGE));
    const next = regenerateShape(leaf, { ...STAR, points: 9 });
    expect(next).not.toBeNull();
    expect(leaf.pose.rotation).toBeCloseTo(0.5);
  });

  it('opens as plain geometry from a file that names no rotation', async () => {
    const svg = (await sceneToSvgString(sceneOf(data), PAGE)).replace(/\s*wd:params-rotation="[^"]*"/, '');
    expect(svg).not.toContain('params-rotation');
    const leaf = await roundTrip(svg);
    expect(shapeGeneratorOf(leaf.data)).toBeNull();
    expect(leaf.data.path).toBeDefined();
  });
});
