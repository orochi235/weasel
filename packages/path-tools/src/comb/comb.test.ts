import { describe, expect, it } from 'vitest';
import { pathFromD, type View } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { createPathEditingOverlayLayer } from '@weasel-js/core';
import { createCombExtension } from './comb';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
// One curved segment, with both handles off their anchors, and one straight.
const PATH = pathFromD('M0 0 C20 20 60 40 100 0 L200 0');

function draw(shown: readonly string[], comb?: { scale: number; samplesPerSegment: number }) {
  const extensions = [createCombExtension(() => comb)];
  const layer = createPathEditingOverlayLayer({
    getEditingId: () => 'p',
    getPose: () => PATH,
    getNode: () => ({ pose: PATH, data: {} }),
    getExtensions: () => extensions,
  });
  const envelope = { getIsVisible: () => (id: string) => id === 'path-edit.anchors' || shown.includes(id) };
  return layer.draw(envelope as never, VIEW, { width: 400, height: 400, dpr: 1 }) as DrawCommand[];
}

describe('path-edit overlay curvature comb', () => {
  it('draws the comb only while chrome-caps shows it', () => {
    const plain = draw([], { scale: 100, samplesPerSegment: 5 }).length;
    // Teeth plus the line through their tips, for the one curved segment.
    expect(draw(['path-edit.comb'], { scale: 100, samplesPerSegment: 5 }).length).toBe(plain + 6);
  });

  it('stands the comb teeth as long as the configured scale makes them', () => {
    const shown = draw(['path-edit.comb'], { scale: 100, samplesPerSegment: 5 });
    const tooth = shown[2];
    if (tooth.kind !== 'path' || tooth.path.kind !== 'polygon') throw new Error('expected a tooth path');
    const [x0, y0, x1, y1] = tooth.path.coords;
    expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(0);
    const longer = draw(['path-edit.comb'], { scale: 200, samplesPerSegment: 5 })[2];
    if (longer.kind !== 'path' || longer.path.kind !== 'polygon') throw new Error('expected a tooth path');
    const [a0, b0, a1, b1] = longer.path.coords;
    expect(Math.hypot(a1 - a0, b1 - b0)).toBeCloseTo(2 * Math.hypot(x1 - x0, y1 - y0), 3);
  });
});
