import { describe, expect, it } from 'vitest';
import { boundsOfPath, type View } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { insertPreviewCommands } from './insertPreviewCommands';

const style = { fill: '#000', stroke: '#000', lineWidth: 1, dash: [] };
const view = (sx: number, sy: number): View => ({ x: 0, y: 0, scale: { x: sx, y: sy } });

/** The screen extent of the preview's outline. */
function outline(geometry: Parameters<typeof insertPreviewCommands>[0]['geometry'], v: View) {
  const cmds = insertPreviewCommands({
    kind: 'insertPreview', visibilityId: 'action.insert-preview', shape: 'polygon',
    bounds: { x: -10, y: -10, width: 20, height: 20 }, geometry, extras: {},
  }, v, style);
  const b = boundsOfPath((cmds[0] as PathDrawCommand).path);
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height };
}

const square = { kind: 'polygon' as const, center: { x: 5, y: 5 }, radius: 10, sides: 4, rotation: Math.PI / 4 };
const star = { kind: 'star' as const, center: { x: 5, y: 5 }, outerRadius: 10, innerRadius: 5, points: 4, rotation: 0 };

describe('insertPreviewCommands radial shapes', () => {
  it.each([square, star])('keeps a $kind its size under a y-flipped view', (geom) => {
    const o = outline(geom, view(1, -1));
    expect(o.w).toBeCloseTo(outline(geom, view(1, 1)).w);
    expect(o.h).toBeCloseTo(outline(geom, view(1, 1)).h);
    expect(o.cx).toBeCloseTo(5);
    expect(o.cy).toBeCloseTo(-5);
  });

  it.each([square, star])('stretches a $kind with a stretched view, as the inserted node draws', (geom) => {
    const flat = outline(geom, view(1, 1));
    const o = outline(geom, view(2, 1));
    expect(o.w).toBeCloseTo(flat.w * 2);
    expect(o.h).toBeCloseTo(flat.h);
  });

  it('mirrors a rotated polygon under a flipped view', () => {
    const tri = { kind: 'polygon' as const, center: { x: 0, y: 0 }, radius: 10, sides: 3, rotation: 0.3 };
    const up = outline(tri, view(1, 1));
    const flipped = outline(tri, view(1, -1));
    expect(flipped.cy).toBeCloseTo(-up.cy);
  });
});
