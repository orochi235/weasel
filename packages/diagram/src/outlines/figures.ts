/**
 * General figures: a rounded rect, a triangle, an octagon, a cloud, a UML
 * actor, and the double ellipse BPMN's intermediate events wear.
 */
import { PathBuilder, polygonFromPoints } from '@weasel-js/core/math';
import { boundsOfPath, ellipsePath, transformPath } from '@weasel-js/geom';
import { KAPPA } from './flowchart';
import { insetByShorter } from './storage';
import type { Bounds, OutlineDef } from './types';

const MAX_RADIUS = 10;
const radiusOf = (w: number, h: number): number => Math.min(MAX_RADIUS, w / 6, h / 6);
/** How far a corner of radius r bites into the inscribed rect, per side. */
const BITE = 1 - Math.SQRT1_2;

const roundRect: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const r = radiusOf(w, h);
    const k = r * KAPPA;
    return new PathBuilder()
      .moveTo(x + r, y)
      .lineTo(x + w - r, y)
      .curveTo(x + w - r + k, y, x + w, y + r - k, x + w, y + r)
      .lineTo(x + w, y + h - r)
      .curveTo(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h)
      .lineTo(x + r, y + h)
      .curveTo(x + r - k, y + h, x, y + h - r + k, x, y + h - r)
      .lineTo(x, y + r)
      .curveTo(x, y + r - k, x + r - k, y, x + r, y)
      .close()
      .build();
  },
  content: ({ x, y, width: w, height: h }) => {
    const i = radiusOf(w, h) * BITE;
    return { x: x + i, y: y + i, width: w - i * 2, height: h - i * 2 };
  },
  boxForContent: (c) => ({ width: c.width + MAX_RADIUS * BITE * 2, height: c.height + MAX_RADIUS * BITE * 2 }),
};

const triangle: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => polygonFromPoints([
    { x: x + w / 2, y }, { x: x + w, y: y + h }, { x, y: y + h },
  ]),
  // The largest rect in a triangle: half its width and half its height, on the base.
  content: ({ x, y, width: w, height: h }) => ({ x: x + w / 4, y: y + h / 2, width: w / 2, height: h / 2 }),
  boxForContent: (c) => ({ width: c.width * 2, height: c.height * 2 }),
};

/** Corner cut, of the shorter side: regular in a square box. */
const CUT = 1 - Math.SQRT1_2;

const octagon: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => {
    const c = Math.min(w, h) * CUT;
    return polygonFromPoints([
      { x: x + c, y }, { x: x + w - c, y }, { x: x + w, y: y + c }, { x: x + w, y: y + h - c },
      { x: x + w - c, y: y + h }, { x: x + c, y: y + h }, { x, y: y + h - c }, { x, y: y + c },
    ]);
  },
  // Its corners sit on the cuts' midpoints.
  content: ({ x, y, width: w, height: h }) => {
    const c = Math.min(w, h) * CUT;
    return { x: x + c / 2, y: y + c / 2, width: w - c, height: h - c };
  },
  boxForContent: (c) => insetByShorter(c, CUT),
};

/** Append a circular arc as cubics of at most a quarter turn each. */
function arc(b: PathBuilder, cx: number, cy: number, r: number, from: number, sweep: number): void {
  const n = Math.ceil(Math.abs(sweep) / (Math.PI / 2));
  const step = sweep / n;
  const k = (4 / 3) * Math.tan(step / 4) * r;
  for (let i = 0; i < n; i++) {
    const a0 = from + step * i;
    const a1 = a0 + step;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    b.curveTo(x0 - k * Math.sin(a0), y0 + k * Math.cos(a0), x1 + k * Math.sin(a1), y1 - k * Math.cos(a1), x1, y1);
  }
}

/** Where the cloud's bumps meet, in degrees round an inner ellipse; uneven
 *  spacing gives uneven bumps. */
const CLOUD_JOINS = [178, 222, 268, 318, 2, 46, 92, 136];
const CLOUD_RX = 0.36;
const CLOUD_RY = 0.3;

/** A semicircular bump on each chord between joins, then scaled to fill the
 *  unit square exactly. Built once; each node stretches it. */
const CLOUD = (() => {
  const pts = CLOUD_JOINS.map((deg) => {
    const t = (deg * Math.PI) / 180;
    return { x: 0.5 + CLOUD_RX * Math.cos(t), y: 0.5 + CLOUD_RY * Math.sin(t) };
  });
  const b = new PathBuilder().moveTo(pts[0]!.x, pts[0]!.y);
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const r = Math.hypot(q.x - p.x, q.y - p.y) / 2;
    const from = Math.atan2(p.y - my, p.x - mx);
    // Bulge away from the center, whichever way round that is.
    const out = (s: number) => Math.hypot(mx + r * Math.cos(from + s) - 0.5, my + r * Math.sin(from + s) - 0.5);
    arc(b, mx, my, r, from, out(Math.PI / 2) > out(-Math.PI / 2) ? Math.PI : -Math.PI);
  });
  const raw = b.close().build();
  const box = boundsOfPath(raw);
  const fit = (p: { x: number; y: number }) => ({ x: (p.x - box.x) / box.width, y: (p.y - box.y) / box.height });
  // The inner ellipse's inscribed rect, shrunk so the chords between joins cannot cross it.
  const lo = fit({ x: 0.5 - (CLOUD_RX * 0.85) / Math.SQRT2, y: 0.5 - (CLOUD_RY * 0.85) / Math.SQRT2 });
  const hi = fit({ x: 0.5 + (CLOUD_RX * 0.85) / Math.SQRT2, y: 0.5 + (CLOUD_RY * 0.85) / Math.SQRT2 });
  return {
    path: transformPath(raw, [1 / box.width, 0, 0, 1 / box.height, -box.x / box.width, -box.y / box.height]),
    content: { x: lo.x, y: lo.y, width: hi.x - lo.x, height: hi.y - lo.y },
  };
})();

const cloud: OutlineDef = {
  path: ({ x, y, width: w, height: h }) => transformPath(CLOUD.path, [w, 0, 0, h, x, y]),
  content: ({ x, y, width: w, height: h }) => ({
    x: x + CLOUD.content.x * w,
    y: y + CLOUD.content.y * h,
    width: CLOUD.content.width * w,
    height: CLOUD.content.height * h,
  }),
  boxForContent: (c) => ({ width: c.width / CLOUD.content.width, height: c.height / CLOUD.content.height }),
};

/** The figure's height, of the box; its label goes in the strip beneath. */
const FIGURE = 0.75;
/** The figure's width, of its own height. */
const FIGURE_ASPECT = 0.6;

/** The figure keeps its proportions, top-centered in the box. */
function figureBox({ x, y, width: w, height: h }: Bounds): Bounds {
  const s = Math.min(h * FIGURE, w / FIGURE_ASPECT);
  return { x: x + (w - s * FIGURE_ASPECT) / 2, y, width: s * FIGURE_ASPECT, height: s };
}

/** A filled head and open strokes for the body: the strokes enclose no area,
 *  so the fill lands only on the head and the node picks by its strokes. */
const actor: OutlineDef = {
  path: (bounds) => {
    const { x, y, height: s } = figureBox(bounds);
    const at = (u: number, v: number): [number, number] => [x + u * s, y + v * s];
    const r = 0.13 * s;
    const b = new PathBuilder().moveTo(x + 0.3 * s + r, y + r);
    arc(b, x + 0.3 * s, y + r, r, 0, Math.PI * 2);
    b.close();
    for (const [from, to] of [
      [at(0.3, 0.26), at(0.3, 0.62)],
      [at(0.02, 0.38), at(0.58, 0.38)],
      [at(0.3, 0.62), at(0.04, 1)],
      [at(0.3, 0.62), at(0.56, 1)],
    ] as const) b.moveTo(...from).lineTo(...to);
    return b.build();
  },
  content: (bounds) => {
    const fig = figureBox(bounds);
    return { x: bounds.x, y: fig.y + fig.height, width: bounds.width, height: bounds.y + bounds.height - fig.y - fig.height };
  },
  boxForContent: (c) => ({ width: c.width, height: c.height / (1 - FIGURE) }),
};

const RING = 3;
const ringOf = (w: number, h: number): number => Math.min(RING, w / 4, h / 4);

const doubleEllipse: OutlineDef = {
  path: ellipsePath,
  detail: ({ x, y, width: w, height: h }) => {
    const g = ringOf(w, h);
    return ellipsePath({ x: x + g, y: y + g, width: w - g * 2, height: h - g * 2 });
  },
  content: ({ x, y, width: w, height: h }) => {
    const g = ringOf(w, h);
    const cw = (w - g * 2) / Math.SQRT2;
    const ch = (h - g * 2) / Math.SQRT2;
    return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, width: cw, height: ch };
  },
  boxForContent: (c) => ({ width: c.width * Math.SQRT2 + RING * 2, height: c.height * Math.SQRT2 + RING * 2 }),
};

export const FIGURE_OUTLINES = { roundRect, triangle, octagon, cloud, actor, doubleEllipse };
