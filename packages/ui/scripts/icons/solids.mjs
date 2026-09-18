// The five Platonic solids, named for the die each one makes. Each is a real
// polyhedron projected orthographically: the faces turned toward the viewer
// supply the edges, and the silhouette is the outline and the fill.

import { BOX, CENTER, P } from './lib/plot.mjs';

const PHI = (1 + Math.sqrt(5)) / 2;
const EPS = 1e-6;
// Finer than the set's 1.5 throughout, and finer again inside the silhouette,
// so a d20's fifteen inner edges do not close up into a solid mass.
const OUTER_WIDTH = 1;
const INNER_WIDTH = 0.6;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a) => {
  const m = Math.hypot(...a);
  return a.map((v) => v / m);
};

/** Every sign combination of a coordinate triple, and its cyclic rotations. */
function expand(triples, cyclic) {
  const out = new Map();
  for (const t of triples) {
    const rots = cyclic
      ? [t, [t[1], t[2], t[0]], [t[2], t[0], t[1]]]
      : [t];
    for (const r of rots)
      for (const sx of [1, -1])
        for (const sy of [1, -1])
          for (const sz of [1, -1]) {
            const p = [r[0] * sx, r[1] * sy, r[2] * sz];
            out.set(p.map((v) => v.toFixed(6)).join(), p);
          }
  }
  return [...out.values()];
}

/** The faces of the convex hull of `pts`, each as vertex indices wound
 *  counterclockwise seen from outside, with its outward normal. */
function hullFaces(pts) {
  const faces = new Map();
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) {
        let nrm = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
        if (Math.hypot(...nrm) < EPS) continue;
        nrm = unit(nrm);
        const side = pts.map((p) => dot(sub(p, pts[i]), nrm));
        if (side.every((s) => s <= EPS)) {
          // already outward
        } else if (side.every((s) => s >= -EPS)) {
          nrm = nrm.map((v) => -v);
        } else continue;
        const on = pts.map((_, m) => m).filter((m) => Math.abs(dot(sub(pts[m], pts[i]), nrm)) < EPS);
        const key = on.join();
        if (faces.has(key)) continue;
        const c = on.reduce((acc, m) => acc.map((v, a) => v + pts[m][a] / on.length), [0, 0, 0]);
        const u = unit(sub(pts[on[0]], c));
        const w = cross(nrm, u);
        on.sort((a, b) => {
          const pa = sub(pts[a], c),
            pb = sub(pts[b], c);
          return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
        });
        faces.set(key, { ids: on, normal: nrm });
      }
  return [...faces.values()];
}

/** Camera looking back along `toward` (the direction from the solid to the
 *  eye), with `up` as close to screen-up as it can be. */
function camera(toward, up) {
  const z = unit(toward);
  const x = unit(cross(up, z));
  const y = cross(z, x);
  return { x, y, z };
}

/** 2D convex hull, counterclockwise on screen. */
function hull2(pts) {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && turn(h.at(-2), h.at(-1), p) <= EPS) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half([...s].reverse())];
}

/** Looking square at a face, with the vertex of it that points most nearly
 *  along `upHint` at the top: the d12 and d20 views, a face centered. */
const faceOn = (hint, upHint) => (pts, faces) => {
  const f = faces.reduce((best, g) => (dot(g.normal, hint) > dot(best.normal, hint) ? g : best));
  const top = f.ids.reduce((b, i) => (dot(pts[i], upHint) > dot(pts[b], upHint) ? i : b));
  return camera(f.normal, pts[top]);
};

/** A vertex straight up, the solid turned `yaw` degrees from the vertex `front`
 *  and seen from `pitch` degrees above its equator: the d4 and d8 views. */
const standing = (apex, front, yaw, pitch) => (pts) => {
  const u = unit(pts[apex]);
  const f = pts[front];
  const h = unit(sub(f, u.map((v) => v * dot(f, u))));
  const side = cross(u, h);
  const [y, p] = [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180];
  const across = h.map((v, i) => v * Math.cos(y) + side[i] * Math.sin(y));
  return camera(
    across.map((v, i) => v * Math.cos(p) + u[i] * Math.sin(p)),
    u,
  );
};

function solid(pts, view) {
  const faces = hullFaces(pts);
  const cam = view(pts, faces);
  const flat = pts.map((p) => [dot(p, cam.x), -dot(p, cam.y)]);
  const lx = Math.min(...flat.map((p) => p[0])),
    hx = Math.max(...flat.map((p) => p[0]));
  const ly = Math.min(...flat.map((p) => p[1])),
    hy = Math.max(...flat.map((p) => p[1]));
  const k = BOX / Math.max(hx - lx, hy - ly);
  const scr = flat.map((p) => [CENTER + (p[0] - (lx + hx) / 2) * k, CENTER + (p[1] - (ly + hy) / 2) * k]);

  const outline = hull2(scr);
  const onOutline = (p) => outline.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4);
  const edges = new Map();
  for (const f of faces) {
    if (dot(f.normal, cam.z) <= EPS) continue;
    f.ids.forEach((a, m) => {
      const b = f.ids[(m + 1) % f.ids.length];
      edges.set([a, b].sort((p, q) => p - q).join(), [a, b]);
    });
  }
  // An edge with both ends on the silhouette is part of it only when the two
  // are neighbors there; otherwise it crosses the face and is drawn inside.
  const outlineIndex = (p) =>
    outline.findIndex((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4);
  const inner = [...edges.values()].filter(([a, b]) => {
    if (!onOutline(scr[a]) || !onOutline(scr[b])) return true;
    const gap = Math.abs(outlineIndex(scr[a]) - outlineIndex(scr[b]));
    return gap !== 1 && gap !== outline.length - 1;
  });

  const ring = `M${outline.map(P).join('L')}Z`;
  return {
    d: ring,
    width: OUTER_WIDTH,
    inner: { d: inner.map(([a, b]) => `M${P(scr[a])}L${P(scr[b])}`).join(''), width: INNER_WIDTH },
    fill: ring,
    join: 'miter',
  };
}

const TETRA = [
  [1, 1, 1],
  [1, -1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
];
const CUBE = expand([[1, 1, 1]], false);
const OCTA = expand([[1, 0, 0]], true);
const DODECA = [...CUBE, ...expand([[0, 1 / PHI, PHI]], true)];
const ICOSA = expand([[0, 1, PHI]], true);

export const SOLIDS = {
  d4: solid(TETRA, standing(0, 3, 0, 10)),
  d6: solid(CUBE, () => camera([1, 1, 1], [0, 1, 0])),
  d8: solid(OCTA, standing(OCTA.findIndex((p) => p[1] === 1), OCTA.findIndex((p) => p[0] === 1), 18, 10)),
  d12: solid(DODECA, faceOn([0, 0, 1], [0, 1, 0])),
  d20: solid(ICOSA, faceOn([0, 0, 1], [0, 1, 0])),
};
