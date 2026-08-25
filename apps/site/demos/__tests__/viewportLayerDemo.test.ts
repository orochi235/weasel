import { describe, it, expect } from 'vitest';
import { createViewportLayer, mat3 } from '@weasel-js/core';
import type { View } from '@weasel-js/core';
import type { DrawCommand, GroupDrawCommand, Mat3 } from '@weasel-js/core/renderer';
import {
  makeRandomScene,
  pipView,
  PIP,
  createSceneSourceLayer,
  createViewIndicatorLayer,
} from '../ViewportLayerDemo';

/** The world rect a viewport shows: its inner view's origin, extended by the
 *  screen bounds divided by the inner scale. */
function pipWorldRect() {
  const view = pipView(makeRandomScene());
  return {
    x0: view.x, y0: view.y,
    x1: view.x + PIP.w / PIP.scale,
    y1: view.y + PIP.h / PIP.scale,
  };
}

describe('ViewportLayerDemo PiP', () => {
  it('lenses a slice of the world that holds scene content', () => {
    // The scene is randomly placed on every mount, so this asserts over many
    // draws: a PiP aimed at a fixed world rect is empty about half the time,
    // which reads as a broken viewport rather than an empty one.
    for (let trial = 0; trial < 200; trial++) {
      const items = makeRandomScene();
      const view = pipView(items);
      const r = {
        x0: view.x, y0: view.y,
        x1: view.x + PIP.w / PIP.scale,
        y1: view.y + PIP.h / PIP.scale,
      };
      const visible = items.filter(
        (n) =>
          n.pose.x < r.x1 && n.pose.x + n.pose.width > r.x0 &&
          n.pose.y < r.y1 && n.pose.y + n.pose.height > r.y0,
      );
      expect(visible.length, `trial ${trial}: PiP world rect ${JSON.stringify(r)} is empty`)
        .toBeGreaterThan(0);
    }
  });

  it('lenses a 150x100 world slice', () => {
    const r = pipWorldRect();
    expect(r.x1 - r.x0).toBeCloseTo(PIP.w / PIP.scale);
    expect(r.y1 - r.y0).toBeCloseTo(PIP.h / PIP.scale);
  });
});

const OUTER: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 600, height: 400 };
const MINIMAP_VIEW: View = { x: -100, y: -100, scale: { x: 0.18, y: 0.18 } };

/** Every rect a command tree paints, in outer-canvas screen pixels — group
 *  transforms composed the way the renderer composes them. */
function paintedRects(cmds: readonly DrawCommand[], parent: Mat3 = mat3.identity()) {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (const c of cmds) {
    if (c.kind === 'group') {
      const g = c as GroupDrawCommand;
      const m = g.transform
        ? mat3.multiply(new Float32Array(parent) as Mat3, g.transform)
        : parent;
      out.push(...paintedRects(g.children, m));
    } else if (c.kind === 'path' && c.path.kind === 'rect') {
      const r = c.path;
      const [x0, y0] = mat3.apply(parent, r.x, r.y);
      const [x1, y1] = mat3.apply(parent, r.x + r.width, r.y + r.height);
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  return out;
}

/** One 60x60 node at a known world position, plus the demo's PiP aimed at it. */
const NODE = { pose: { x: 300, y: 250, width: 60, height: 60 }, data: { color: '#7fb069' } };
const NODE_VIEW = pipView([
  { ...NODE, id: 'n0' as never, kind: 'leaf' as const, layer: 'default' as const },
]);

function viewportOver(view: View, bounds: { x: number; y: number; w: number; h: number }) {
  return createViewportLayer<unknown>({
    id: 'v',
    label: 'v',
    source: [createSceneSourceLayer(() => [NODE])],
    view,
    bounds: () => bounds,
    background: 'rgba(0,0,0,0.4)',
  });
}

describe('ViewportLayerDemo source layers emit world coordinates', () => {
  const PIP_BOUNDS = { x: PIP.margin, y: DIMS.height - PIP.h - PIP.margin, w: PIP.w, h: PIP.h };

  it('paints a 60-unit node at 60 x inner scale, not 60 x inner scale squared', () => {
    const cmds = viewportOver(NODE_VIEW, PIP_BOUNDS).draw(undefined, OUTER, DIMS);
    // The background rect fills the bounds; the node is the other one.
    const node = paintedRects(cmds).find((r) => r.w !== PIP.w)!;
    expect(node, 'source layer painted nothing').toBeDefined();
    expect(node.w).toBeCloseTo(NODE.pose.width * PIP.scale);
    expect(node.h).toBeCloseTo(NODE.pose.height * PIP.scale);
  });

  it('lands the node the PiP is centered on inside the PiP rect', () => {
    const cmds = viewportOver(NODE_VIEW, PIP_BOUNDS).draw(undefined, OUTER, DIMS);
    const node = paintedRects(cmds).find((r) => r.w !== PIP.w)!;
    expect(node.x).toBeGreaterThanOrEqual(PIP_BOUNDS.x);
    expect(node.y).toBeGreaterThanOrEqual(PIP_BOUNDS.y);
    expect(node.x + node.w).toBeLessThanOrEqual(PIP_BOUNDS.x + PIP_BOUNDS.w);
    expect(node.y + node.h).toBeLessThanOrEqual(PIP_BOUNDS.y + PIP_BOUNDS.h);
  });

  it('scales the same node down by the minimap view, once', () => {
    const bounds = { x: DIMS.width - 188, y: 8, w: 180, h: 120 };
    const cmds = viewportOver(MINIMAP_VIEW, bounds).draw(undefined, OUTER, DIMS);
    const node = paintedRects(cmds).find((r) => r.w !== bounds.w)!;
    // 60 x 0.18 = 10.8 px. Applied twice it is 1.94 px — a dot, which is what
    // a doubly-transformed minimap looks like.
    expect(node.w).toBeCloseTo(NODE.pose.width * MINIMAP_VIEW.scale.x);
  });

  it('sizes the visible-area indicator by the main view, not the lensing one', () => {
    const indicator = createViewIndicatorLayer(() => OUTER);
    const bounds = { x: 0, y: 0, w: 180, h: 120 };
    const layer = createViewportLayer<unknown>({
      id: 'v', label: 'v', source: [indicator], view: MINIMAP_VIEW, bounds: () => bounds,
    });
    const [rect] = paintedRects(layer.draw(undefined, OUTER, DIMS));
    // The main canvas sees 600x400 world units at 1x; the minimap shows that
    // window at 0.18x.
    expect(rect!.w).toBeCloseTo(DIMS.width * MINIMAP_VIEW.scale.x);
    expect(rect!.h).toBeCloseTo(DIMS.height * MINIMAP_VIEW.scale.y);
  });
});
