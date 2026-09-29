/**
 * Resize handles on a turned target, under non-uniform zoom.
 *
 * The overlay paints each handle as a square turned to the target; the grab
 * region has to be that square, and the slops overlay has to draw the region
 * the hit-test uses — not its own reconstruction of it.
 */
import { describe, expect, it } from 'vitest';
import type { DrawCommand, GroupDrawCommand, PathDrawCommand } from '../renderer';
import { createSelectionOverlayLayer } from 'features/selection/overlay';
import { createCornerResizeAffordance } from './cornerResize';
import { hitAffordanceRegions } from './hitAffordanceRegions';
import { createSlopsDebugLayer } from 'canvas/slopsDebugLayer';
import { viewToTransform } from 'core/viewport/view';
import { screenToWorld } from 'core/viewport/viewTransform';
import { asNodeId } from 'core/scene/types';
import type { ChromeState } from 'core/selection/chromeState';
import type { Affordance } from './types';

const B = { x: 10, y: 20, width: 40, height: 20, rotation: Math.PI / 5 };
const VIEW = { x: 5, y: -3, scale: { x: 4, y: 1 } };
const DIMS = { width: 800, height: 600 };
const T = viewToTransform(VIEW);
const SIZE = 16;

const state = {
  selection: [asNodeId('a')],
  multiActive: false,
  boundsOf: () => B,
  unionBounds: null,
  modifiers: { shift: false, alt: false, meta: false, ctrl: false },
} as unknown as ChromeState;
const envelope = { getChromeState: () => state };

const hitsAtScreen = (affs: Affordance[], sx: number, sy: number) => {
  const [wx, wy] = screenToWorld(sx, sy, T);
  return hitAffordanceRegions(affs, wx, wy, state, VIEW) !== null;
};

/** Screen center and angle of each painted handle. */
function paintedHandles(): { x: number; y: number; angle: number }[] {
  const layer = createSelectionOverlayLayer({
    getSelection: () => [asNodeId('a')],
    handles: { size: SIZE },
    outline: { paint: { fill: 'solid', color: '#000' }, width: 1, pad: 0 },
  });
  const tree = layer.draw(envelope, VIEW, DIMS);
  return tree.filter((c): c is GroupDrawCommand => c.kind === 'group').map((g) => {
    const r = (g.children[0] as PathDrawCommand).path as { x: number; y: number; width: number };
    const m = g.transform!;
    return { x: r.x + r.width / 2, y: r.y + r.width / 2, angle: Math.atan2(m[1], m[0]) };
  });
}

describe('resize handles on a turned target under 4:1 zoom', () => {
  const corner = createCornerResizeAffordance({ handleHitRadius: SIZE / 2 });
  const handles = paintedHandles();

  it('paints four turned handles', () => {
    expect(handles).toHaveLength(4);
    for (const h of handles) expect(Math.abs(h.angle)).toBeGreaterThan(0.1);
  });

  it('is grabbable across the painted square and nowhere past it', () => {
    const half = SIZE / 2;
    for (const h of handles) {
      const at = (u: number, v: number) => {
        const c = Math.cos(h.angle), s = Math.sin(h.angle);
        return hitsAtScreen([corner], h.x + c * u - s * v, h.y + s * u + c * v);
      };
      for (const [u, v] of [[0, 0], [half - 0.3, half - 0.3], [-(half - 0.3), half - 0.3]]) {
        expect(at(u, v)).toBe(true);
      }
      expect(at(half + 0.3, 0)).toBe(false);
      expect(at(0, -(half + 0.3))).toBe(false);
    }
  });
});

describe('the slops overlay draws the regions the hit-test walks', () => {
  // A radius the old overlay could not know about: it recomputed the default.
  const affs = [createCornerResizeAffordance({ handleHitRadius: 11 })];
  const draw = () => createSlopsDebugLayer({ getAffordances: () => affs })
    .draw(envelope, VIEW, DIMS) as DrawCommand[];

  const inHalo = (halos: DrawCommand[], x: number, y: number) => halos.some((c) => {
    if (c.kind !== 'path' || c.path.kind !== 'polygon') return false;
    const q = c.path.coords;
    let pos = 0, neg = 0;
    for (let i = 0; i < 8; i += 2) {
      const j = (i + 2) % 8;
      const cr = (q[j]! - q[i]!) * (y - q[i + 1]!) - (q[j + 1]! - q[i + 1]!) * (x - q[i]!);
      if (cr > 0) pos++; else if (cr < 0) neg++;
    }
    return pos === 0 || neg === 0;
  });

  it('draws one halo per point region', () => {
    expect(draw()).toHaveLength(4);
  });

  it('covers exactly the points that hit', () => {
    const halos = draw();
    let checked = 0;
    for (const h of handles()) {
      for (let dx = -16; dx <= 16; dx += 1.7) {
        for (let dy = -16; dy <= 16; dy += 1.7) {
          expect(inHalo(halos, h.x + dx, h.y + dy), `(${dx}, ${dy})`).toBe(hitsAtScreen(affs, h.x + dx, h.y + dy));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  function handles() {
    return paintedHandles();
  }
});
