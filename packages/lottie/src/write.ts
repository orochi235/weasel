/**
 * A clip and the SVG nodes it moves written as a Lottie animation: one shape layer per path, its
 * geometry baked in, with the clip's opacity and trim tracks keyframed on it.
 */
import type { Clip } from '@weasel-js/animator';
import { boundsOfPath, identity, multiply, rotatePathAbout, transformPath, type Affine, type Path, type Rect } from '@weasel-js/geom';
import { tryParseColor } from '@weasel-js/paint';
import type { SvgNode, SvgPaint, SvgPathNode, SvgStroke } from '@weasel-js/svg';
import { svgBoundsOf } from '@weasel-js/svg';
import {
  createWarnOnce, nodeKindsIn, planClip, strokeLossWarning, strokelessTrimWarning, trimEdgesOf, type Frame, type PlannedTrack, type Warn,
} from '@weasel-js/svg/internal';
import { scalarOf } from './keyframes';
import { lottieShapesOf } from './shape';
import type {
  LottieAnimation, LottieFill, LottieGroup, LottiePoint, LottieScalar, LottieShapeItem, LottieShapeLayer, LottieStatic,
  LottieStroke, LottieTransform, LottieTrim,
} from './types';

export interface WriteLottieOptions {
  /** Frames a second. Default 60. */
  fps?: number;
  /** Called once for each thing the animation cannot carry. */
  onWarn?: (message: string) => void;
  /** The canvas, in the nodes' coordinates. Default: `svgBoundsOf(nodes)`. */
  viewBox?: Rect;
}

/** A path node with everything above it folded in: `ctm` maps its path to the root. */
interface Leaf { node: SvgPathNode; path: Path; ctm: Affine; opacity: number }

const held = <T>(k: T): LottieStatic<T> => ({ a: 0, k });
const CAPS = { butt: 1, round: 2, square: 3 } as const;
const JOINS = { miter: 1, round: 2, bevel: 3 } as const;
function transformOf(position: LottiePoint, opacity: LottieScalar): LottieTransform {
  return { a: held([0, 0]), p: held(position), s: held([100, 100]), r: held(0), o: opacity };
}

/** The drawn path nodes of `nodes` in document order, each in root coordinates. */
function leavesOf(nodes: readonly SvgNode[], warn: Warn, ctm: Affine = identity(), opacity = 1): Leaf[] {
  return nodes.flatMap((node): Leaf[] => {
    if (node.hidden) return [];
    if (node.kind === 'group') {
      const own = node.opacity ?? 1;
      const leaves = leavesOf(node.children, warn, node.transform ? multiply(ctm, node.transform) : ctm, opacity * own);
      if (own !== 1 && leaves.length > 1) {
        warn('a group\'s opacity is applied to each path in it, so where they overlap they show through each other');
      }
      return leaves;
    }
    if (node.kind !== 'path') {
      warn(`a ${node.kind} node has no Lottie form here; it is skipped`);
      return [];
    }
    let path = node.path;
    if (node.rotation) {
      const b = boundsOfPath(path);
      path = rotatePathAbout(path, b.x + b.width / 2, b.y + b.height / 2, node.rotation);
    }
    return [{ node, path: transformPath(path, ctm), ctm, opacity }];
  });
}

/** A solid paint as a Lottie color and opacity in percent; null for any other, warning where its color is unreadable. */
function colorOf(paint: SvgPaint, alpha: number, what: string, warn: Warn): { c: LottieStatic<number[]>; o: LottieScalar } | null {
  if (paint.kind !== 'solid') return null;
  const rgba = tryParseColor(paint.color);
  if (!rgba) {
    warn(`${what} color ${paint.color}, which this writer cannot read; it is skipped`);
    return null;
  }
  const [r, g, b, a] = rgba;
  return { c: held([r, g, b, 1]), o: held(a * (paint.opacity ?? 1) * alpha * 100) };
}

/** How much `ctm` scales a width: the square root of its area scale, exact where it scales evenly. */
function widthScaleOf(ctm: Affine, label: string, warn: Warn): number {
  const [a, b, c, d] = ctm;
  const tolerance = 1e-9 * Math.max(1, a * a + b * b);
  if (Math.abs(a * a + b * b - (c * c + d * d)) > tolerance || Math.abs(a * c + b * d) > tolerance) {
    warn(`${label} is scaled unevenly, which a Lottie stroke width cannot follow; its stroke takes the mean scale`);
  }
  return Math.sqrt(Math.abs(a * d - b * c));
}

function strokeOf(stroke: SvgStroke, ctm: Affine, label: string, warn: Warn): LottieStroke | null {
  const dropped = [
    stroke.dash?.length ? 'dashes' : '',
    stroke.markerStart || stroke.markerMid || stroke.markerEnd ? 'markers' : '',
    stroke.vertexWidths || stroke.nib ? 'a varying width' : '',
    stroke.align && stroke.align !== 'center' ? 'an alignment' : '',
  ].filter(Boolean);
  if (dropped.length > 0) warn(strokeLossWarning(label, dropped));
  if (stroke.paint.kind === 'gradient') {
    warn(`${label} has a gradient stroke, which this writer does not write; it is skipped`);
    return null;
  }
  const color = colorOf(stroke.paint, stroke.opacity ?? 1, `${label} has a stroke`, warn);
  if (!color) return null;
  const width = (typeof stroke.width === 'number' ? stroke.width : stroke.width.px) * widthScaleOf(ctm, label, warn);
  return {
    ty: 'st', ...color, w: held(width), lc: CAPS[stroke.cap ?? 'butt'], lj: JOINS[stroke.join ?? 'miter'], ml: stroke.miterLimit ?? 4,
  };
}

function fillOf({ node, path }: Leaf, label: string, warn: Warn): LottieFill | null {
  if (node.fill.kind === 'gradient') {
    warn(`${label} has a gradient fill, which this writer does not write; it is skipped`);
    return null;
  }
  const color = colorOf(node.fill, 1, `${label} has a fill`, warn);
  if (!color) return null;
  return { ty: 'fl', ...color, r: path.kind === 'polygon' && path.fillRule === 'evenodd' ? 2 : 1 };
}

/** A track's value times `factor` as a scalar in percent, or `fallback` where there is no track. */
function percentOf(track: PlannedTrack | undefined, fallback: number, fps: number, factor = 1): LottieScalar {
  const percent = (f: Frame) => (f.value as number) * factor * 100;
  if (!track) return held(fallback);
  return track.still ? held(percent(track.still)) : scalarOf(track.frames, percent, fps);
}

function layerOf(leaf: Leaf, tracks: Map<string, PlannedTrack>, ctx: { fps: number; op: number; origin: LottiePoint; ind: number; warn: Warn }): LottieShapeLayer {
  const { node, opacity } = leaf;
  const { fps, warn } = ctx;
  const label = node.id === undefined ? 'a path' : `#${node.id}`;
  const shapes = lottieShapesOf(leaf.path).map((k): LottieShapeItem => ({ ty: 'sh', ks: held(k) }));
  const stroke = node.stroke ? strokeOf(node.stroke, leaf.ctm, label, warn) : null;
  const fill = fillOf(leaf, label, warn);
  const tr: LottieShapeItem = { ty: 'tr', ...transformOf([0, 0], held(100)) };
  const start = tracks.get('trim.start');
  const end = tracks.get('trim.end');
  if (!node.stroke && (start || end)) warn(strokelessTrimWarning(label));
  const groups: LottieGroup[] = [];
  if (stroke && (start || end || node.stroke?.trim)) {
    const [from, to] = trimEdgesOf(node);
    const tm: LottieTrim = { ty: 'tm', s: percentOf(start, from * 100, fps), e: percentOf(end, to * 100, fps), o: held(0), m: 2 };
    groups.push({ ty: 'gr', it: [...shapes, stroke, tm, tr] });
    if (fill) groups.push({ ty: 'gr', it: [...shapes, fill, tr] });
  } else {
    groups.push({ ty: 'gr', it: [...shapes, ...(stroke ? [stroke] : []), ...(fill ? [fill] : []), tr] });
  }
  const o = percentOf(tracks.get('opacity'), (node.opacity ?? 1) * opacity * 100, fps, opacity);
  return {
    ddd: 0, ind: ctx.ind, ty: 4, nm: node.id ?? `path ${ctx.ind}`, sr: 1, ks: transformOf(ctx.origin, o), ao: 0,
    shapes: groups, ip: 0, op: ctx.op, st: 0, bm: 0,
  };
}

/**
 * `nodes` as a Lottie animation moved by `clip`, at `opts.fps` frames a second (default 60). Each
 * drawn path is a shape layer with its solid fill and stroke, the last drawn first, as Lottie draws
 * its first layer on top; group transforms and rotations are baked into the geometry. A track
 * `<id>.opacity` keys the layer's opacity, and `<id>.trim.start` / `<id>.trim.end` (fractions of
 * the path's length) a trim of its stroke; an edge with no track rests where the stroke's own trim
 * puts it. The canvas is `opts.viewBox`, else `svgBoundsOf(nodes)`. Lottie players loop,
 * so a clip that does not loop warns; so does each track, paint or node this cannot write, through
 * `opts.onWarn`, once each.
 */
export function writeLottie(nodes: SvgNode[], clip: Clip, opts: WriteLottieOptions = {}): LottieAnimation {
  const fps = opts.fps ?? 60;
  const warn = createWarnOnce(opts.onWarn);
  const plan = planClip(clip, nodeKindsIn(nodes), 'Lottie', warn);
  if (plan.passes !== Infinity) {
    const times = plan.passes === 1 ? 'once' : `${plan.passes} times`;
    warn(`the clip plays ${times}, but Lottie has no field for how often an animation plays and players loop by default`);
  }
  const byId = new Map<string, Map<string, PlannedTrack>>();
  for (const track of plan.tracks) {
    const label = `${track.id}.${track.prop}`;
    if ([track.still, ...track.frames].some((f) => f !== undefined && typeof f.value !== 'number')) {
      warn(`${label} holds a value that is not a number; it is skipped`);
      continue;
    }
    const props = byId.get(track.id) ?? byId.set(track.id, new Map()).get(track.id)!;
    props.set(track.prop, track);
  }
  const box = opts.viewBox ?? svgBoundsOf(nodes);
  const op = Math.max(1, Number(((plan.duration / 1000) * fps).toFixed(4)));
  const origin: LottiePoint = [-box.x, -box.y];
  const leaves = leavesOf(nodes, warn);
  const layers = leaves.map((leaf, n) => {
    const tracks = (leaf.node.id !== undefined && byId.get(leaf.node.id)) || new Map<string, PlannedTrack>();
    if (leaf.node.id !== undefined) byId.delete(leaf.node.id);
    return layerOf(leaf, tracks, { fps, op, origin, ind: n + 1, warn });
  }).reverse();
  for (const id of byId.keys()) warn(`the clip moves #${id}, which is not a drawn path; its tracks are skipped`);
  return {
    v: '5.12.0', fr: fps, ip: 0, op, w: Math.ceil(box.width), h: Math.ceil(box.height), ddd: 0, assets: [], layers,
  };
}
