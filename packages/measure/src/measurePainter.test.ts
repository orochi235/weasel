import { afterEach, describe, expect, it, vi } from 'vitest';
import { pathToD, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RectPose, SceneNode } from '@weasel-js/core';
import { MEASURE_PAINTER, MEASURE_TICK_PX } from './measurePainter';

const POSE: RectPose = { x: 0, y: 0, width: 100, height: 0 };
const node = { id: 'm', kind: 'node', pose: POSE, data: { measure: { start: { x: 0, y: 0 }, end: { x: 100, y: 0 } } } } as unknown as SceneNode<unknown, string, unknown>;

/** How far the tick at the start reaches either side of the line, which runs along y = 0, in world units. */
const tickHalf = (cmds: readonly DrawCommand[]): number => {
  const ds = cmds.map((c) => pathToD((c as { path: Path }).path));
  const ys = ds.map((d) => [...d.matchAll(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g)].map(Number).filter((_, i) => i % 2 === 1));
  return Math.max(...ys.flatMap((y) => y.map(Math.abs)));
};

afterEach(() => vi.unstubAllGlobals());

describe('MEASURE_PAINTER', () => {
  it('sizes its ticks in screen pixels at the view scale the frame paints at, whatever the window density', () => {
    vi.stubGlobal('devicePixelRatio', 1);
    const cmds = MEASURE_PAINTER.paint(node, POSE, { pixelScale: 4, scale: 2 }) as DrawCommand[];
    expect(tickHalf(cmds)).toBeCloseTo(MEASURE_TICK_PX / 2);
  });

  it('draws world-sized ticks with no view to size them against', () => {
    const cmds = MEASURE_PAINTER.paint(node, POSE, undefined) as DrawCommand[];
    expect(tickHalf(cmds)).toBeCloseTo(MEASURE_TICK_PX);
  });
});
