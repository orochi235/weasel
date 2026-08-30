/**
 * Deterministic fixture builders for the benchmark suite.
 *
 * Everything random here comes from `mulberry32`, seeded per builder, so two
 * runs on the same machine compare like for like. No bare `Math.random()`.
 */
import {
  PATH_M, PATH_L, PATH_C, PATH_Z,
  type PolygonPath, type RectPath,
} from 'core/geometry/path';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import type { ResolvedRun } from '@weasel-js/text';

/** Small fast PRNG. Same seed, same stream, on every engine. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Paths ────────────────────────────────────────────────────────────────

/**
 * A closed single-contour path made of `curves` cubic segments arranged
 * around a lobed circle. Every control offset is proportional to its own
 * chord, and the radius varies by a smooth sine rather than per-point noise.
 *
 * Both of those are load-bearing. Independent random radii self-intersect
 * once the angular step drops below the radial jitter, and a self-intersecting
 * contour sends earcut quadratic — at 512 segments that measured 2.8 s per
 * tessellation, which is a benchmark of the fixture, not of the tessellator.
 */
export function curvyPath(curves: number, seed = 1): PolygonPath {
  const rnd = mulberry32(seed);
  const lobes = 3 + Math.floor(rnd() * 4);
  const phase = rnd() * Math.PI * 2;
  const r = 200;
  const commands: number[] = [PATH_M];
  const coords: number[] = [];
  const pt = (i: number): [number, number] => {
    const t = (i / curves) * Math.PI * 2;
    const rr = r * (1 + 0.25 * Math.sin(lobes * t + phase));
    return [Math.cos(t) * rr, Math.sin(t) * rr];
  };
  let [px, py] = pt(0);
  coords.push(px, py);
  for (let i = 1; i <= curves; i++) {
    const [nx, ny] = i === curves ? [coords[0], coords[1]] : pt(i);
    const dx = nx - px, dy = ny - py;
    const chord = Math.hypot(dx, dy) || 1;
    // S-bow off the chord, sized as a fraction of it. A straight cubic
    // subdivides once and would make the tolerance axis inert.
    const bow = chord * (0.2 + 0.3 * rnd());
    const mx = (px + nx) / 2, my = (py + ny) / 2;
    commands.push(PATH_C);
    coords.push(
      mx + (-dy / chord) * bow, my + (dx / chord) * bow,
      mx - (-dy / chord) * bow, my - (dx / chord) * bow,
      nx, ny,
    );
    px = nx; py = ny;
  }
  commands.push(PATH_Z);
  return {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
}

/** A closed polygon of `sides` straight edges — no curves, so tolerance is inert. */
export function polygonPath(sides: number, radius = 100, cx = 0, cy = 0, seed = 2): PolygonPath {
  const rnd = mulberry32(seed);
  const commands: number[] = [PATH_M];
  const coords: number[] = [];
  for (let i = 0; i < sides; i++) {
    const t = (i / sides) * Math.PI * 2;
    const rr = radius * (0.75 + 0.5 * rnd());
    if (i > 0) commands.push(PATH_L);
    coords.push(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr);
  }
  commands.push(PATH_Z);
  return {
    kind: 'polygon',
    commands: new Uint8Array(commands),
    coords: new Float32Array(coords),
    fillRule: 'nonzero',
  };
}

export function rectPath(x: number, y: number, width: number, height: number): RectPath {
  return { kind: 'rect', x, y, width, height };
}

// ── Scenes ───────────────────────────────────────────────────────────────

export type BenchPose = { x: number; y: number; width: number; height: number };
export type BenchScene = Scene<{ n: number }, 'main', unknown>;

const LAYERS = [{ id: 'main' as const }];

export function emptyScene(historyLimit = 4): BenchScene {
  let i = 0;
  return createScene<{ n: number }, 'main', unknown>({
    systemLayers: LAYERS,
    historyLimit,
    generateId: () => asNodeId(`b${(i++).toString(36)}`),
  });
}

/**
 * A container chain `depth` levels deep, returning the deepest container's id.
 * `depth: 0` means "no containers" — the returned id is `null` (roots).
 */
export function containerChain(scene: BenchScene, depth: number): NodeId | null {
  let parent: NodeId | null = null;
  for (let d = 0; d < depth; d++) {
    parent = scene.add({
      kind: 'container',
      layer: 'main',
      pose: { x: 0, y: 0, width: 1000, height: 1000 },
      data: { n: d },
      ...(parent !== null ? { parent } : {}),
    });
  }
  return parent;
}

/** `count` leaves, all children of `parent`. */
export function fillLeaves(
  scene: BenchScene,
  parent: NodeId | null,
  count: number,
  pose: (i: number) => unknown,
): void {
  for (let i = 0; i < count; i++) {
    scene.add({
      kind: 'leaf',
      layer: 'main',
      pose: pose(i),
      data: { n: i },
      ...(parent !== null ? { parent } : {}),
    });
  }
}

/**
 * A scene of `count` leaves spread over a `span`-square world, laid out on a
 * seeded scatter. `shape: 'rect'` gives plain rect poses (the AABB fast path);
 * `shape: 'polygon'` gives `sides`-gon path poses (the silhouette kernel).
 */
export function scatterScene(
  count: number,
  opts: { shape?: 'rect' | 'polygon'; sides?: number; span?: number; seed?: number } = {},
): BenchScene {
  const { shape = 'rect', sides = 24, span = 4000, seed = 7 } = opts;
  const rnd = mulberry32(seed);
  const scene = emptyScene();
  for (let i = 0; i < count; i++) {
    const x = rnd() * span;
    const y = rnd() * span;
    const pose = shape === 'rect'
      ? { x, y, width: 40, height: 40 }
      : polygonPath(sides, 20, x, y, seed + i);
    scene.add({ kind: 'leaf', layer: 'main', pose, data: { n: i } });
  }
  return scene;
}

/**
 * `count` leaves under a container chain `depth` deep — the shape
 * `renderOrder()`'s DFS actually has to walk.
 */
export function deepScene(count: number, depth: number): BenchScene {
  const scene = emptyScene();
  const leaf = containerChain(scene, depth);
  fillLeaves(scene, leaf, count, (i) => ({ x: i, y: i, width: 10, height: 10 }));
  return scene;
}

export type LayeredScene = Scene<{ n: number }, string, unknown>;

/**
 * `count` flat leaves dealt round-robin across `layers` layers, so every layer
 * holds an equal share. Sweeping `layers` at a fixed `count` isolates
 * `renderOrder()`'s layer axis from its node-count axis.
 */
export function layeredScene(count: number, layers: number): LayeredScene {
  let i = 0;
  const scene = createScene<{ n: number }, string, unknown>({
    systemLayers: Array.from({ length: layers }, (_, l) => ({ id: `L${l}` })),
    historyLimit: 4,
    generateId: () => asNodeId(`b${(i++).toString(36)}`),
  });
  for (let n = 0; n < count; n++) {
    scene.add({
      kind: 'leaf',
      layer: `L${n % layers}`,
      pose: { x: n, y: n, width: 10, height: 10 },
      data: { n },
    });
  }
  return scene;
}

// ── Text runs ────────────────────────────────────────────────────────────

const WORDS = [
  'the', 'weasel', 'canvas', 'renders', 'glyphs', 'quickly', 'enough',
  'for', 'most', 'documents', 'though', 'layout', 'dominates', 'a', 'frame',
];

/** Deterministic prose of roughly `glyphs` characters. */
export function proseOf(glyphs: number, seed = 11): string {
  const rnd = mulberry32(seed);
  let out = '';
  while (out.length < glyphs) {
    out += (out.length > 0 ? ' ' : '') + WORDS[Math.floor(rnd() * WORDS.length)];
  }
  return out.slice(0, glyphs);
}

/**
 * A BMFont JSON covering printable ASCII, with a kerning table.
 *
 * `@weasel-js/font`'s exported `FIXTURE_FONT` carries two glyphs — `A` and
 * `B`. Laying out prose against it sends every other codepoint down
 * `resolveGlyph`'s miss path (dynamic-tier escalation, then a warn), so the
 * measurement would be of the fallback, not of layout. Metrics here are
 * synthetic but deterministic; the numbers describe this atlas, and only the
 * shape of the curve against glyph count carries over to a real face.
 */
export function benchFontJson(seed = 17): unknown {
  const rnd = mulberry32(seed);
  const chars: Array<Record<string, number>> = [];
  for (let cp = 32; cp <= 126; cp++) {
    const w = cp === 32 ? 0 : 10 + (cp % 12);
    chars.push({
      id: cp,
      x: ((cp - 32) % 16) * 32,
      y: Math.floor((cp - 32) / 16) * 32,
      width: w,
      height: cp === 32 ? 0 : 22 + (cp % 7),
      xoffset: 1,
      yoffset: 4,
      xadvance: w + 3,
      page: 0,
    });
  }
  // Real faces ship thousands of pairs; the lookup is a nested Map, so what
  // matters is that the hot path finds entries rather than missing every time.
  const kernings: Array<Record<string, number>> = [];
  for (let first = 65; first <= 122; first++) {
    for (let k = 0; k < 12; k++) {
      const second = 65 + Math.floor(rnd() * 58);
      kernings.push({ first, second, amount: -1 - Math.floor(rnd() * 2) });
    }
  }
  return {
    info: { face: 'inter', size: 32 },
    common: { lineHeight: 38, base: 29, scaleW: 512, scaleH: 512 },
    chars,
    kernings,
  };
}

export function plainRun(text: string, fontSize = 16): ResolvedRun {
  return {
    text,
    fontFamily: 'inter',
    fontSize,
    fontWeight: 400,
    fontStyle: 'normal',
    fill: { fill: 'solid', color: '#000' },
    letterSpacing: 0,
    underline: false,
    strikethrough: false,
    overline: false,
    baselineShift: 0,
  };
}

/** `count` runs alternating weight, so layout has to open a group per switch. */
export function alternatingRuns(count: number, glyphsPerRun: number, seed = 13): ResolvedRun[] {
  const out: ResolvedRun[] = [];
  for (let i = 0; i < count; i++) {
    const run = plainRun(proseOf(glyphsPerRun, seed + i));
    out.push(i % 2 === 0 ? run : { ...run, fontWeight: 700 });
  }
  return out;
}
