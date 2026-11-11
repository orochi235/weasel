/**
 * Random draw-command trees for the culling property tests, and the oracle they check a cull against: every command
 * painting a point inside the view stays, and nothing is reordered or changed. Test-only.
 */
import fc from 'fast-check';
import { expect } from 'vitest';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { getMesh } from './cache/cache';
import { strokeMesh } from './cache/strokeMeshCache';
import type { CullRect } from './cullDrawCommands';
import type { DrawCommand, GroupDrawCommand } from './DrawCommand';
import { pathBox, type ScreenBox } from './paintedBounds';
import { resolveStrokeLengths, type StrokedPathCommand } from './strokeLengths';
import { affine, anyPath, meshPoints, rectPath, spread, type tally, type Pt } from './pbt.fixture';

const PAINT = { kind: 'solid' as const, color: '#000' };
export const IMAGE = {} as ImageBitmap;
const PROGRAM = { id: 'pbt-effect' } as never;

/** Center-aligned world strokes: what the ribbon cache builds is then exactly what draws. */
const plainStroke = fc.record({
  width: fc.double({ min: 0.25, max: 20, noNaN: true }),
  cap: fc.constantFrom('butt' as const, 'round' as const, 'square' as const),
  join: fc.constantFrom('miter' as const, 'round' as const, 'bevel' as const),
});

const leaf: fc.Arbitrary<DrawCommand> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ path: anyPath, stroke: fc.option(plainStroke, { nil: undefined }) })
    .map(({ path, stroke }): DrawCommand => (stroke
      ? { kind: 'path', path, stroke: { ...stroke, paint: PAINT } }
      : { kind: 'path', path, fill: { paint: PAINT } })) },
  { weight: 2, arbitrary: fc.tuple(spread(-300, 300), spread(-300, 300), spread(-200, 200), spread(-200, 200))
    .map(([x, y, w, h]): DrawCommand => ({ kind: 'image', image: IMAGE, x, y, w, h })) },
  // A program with no source the renderer knows: it may draw anywhere.
  { weight: 1, arbitrary: fc.constant({ kind: 'shader', program: { id: 'pbt-unknown' }, bounds: { x: 0, y: 0, w: 1, h: 1 } } as unknown as DrawCommand) },
);

/** A transform keeping most of what it draws near the view, so both sides of the cut come up. */
export const near = fc.oneof(fc.constant(mat3.identity()), affine.map((m) => {
  const k = 1 / Math.max(1, Math.sqrt(Math.abs(m[0] * m[4] - m[1] * m[3])));
  return mat3.fromAffine([m[0] * k, m[1] * k, m[3] * k, m[4] * k, m[6] / 4, m[7] / 4]);
}));

const { tree: rawTree } = fc.letrec<{ tree: DrawCommand[]; node: DrawCommand }>((tie) => ({
  tree: fc.array(tie('node'), { maxLength: 4 }),
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    leaf,
    fc.record({
      children: tie('tree'),
      transform: fc.option(near, { nil: undefined }),
      clip: fc.option(rectPath, { nil: undefined }),
      composite: fc.option(fc.constantFrom('source-over' as const, 'xor' as const, 'destination-in' as const), { nil: undefined }),
      reach: fc.option(fc.oneof(fc.integer({ min: 0, max: 40 }), fc.constant(undefined)), { nil: null }),
      isolate: fc.option(fc.constant(true), { nil: undefined, freq: 1 }),
    }).map(({ children, transform, clip, composite, reach, isolate }): DrawCommand => ({
      kind: 'group', children,
      ...(isolate ? { isolate } : {}),
      ...(transform ? { transform } : {}),
      // A clip on an effects group bounds its output, which the oracle below does not model.
      ...(clip && reach === null ? { clip } : {}),
      ...(composite ? { composite } : {}),
      ...(reach !== null ? { effects: [{ program: PROGRAM, ...(reach === undefined ? {} : { reach }) }] } : {}),
    })),
  ),
}));

/** Each command tagged apart, so a group the cull copies is still told from its neighbors. */
export const tree = rawTree.map((cmds) => {
  let n = 0;
  const tag = (list: DrawCommand[]): DrawCommand[] => list.map((c) => ({
    ...c, pbt: n++, ...(c.kind === 'group' ? { children: tag(c.children) } : {}),
  }) as DrawCommand);
  return tag(cmds);
});

export const view: fc.Arbitrary<CullRect> = fc.record({
  x: spread(-400, 200), y: spread(-400, 200),
  width: fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 4, arbitrary: spread(0, 600) }),
  height: fc.oneof({ weight: 1, arbitrary: fc.constant(0) }, { weight: 4, arbitrary: spread(0, 600) }),
});

/** Screen points `cmd` paints under `m`: the fill's or ribbon's vertices, an image's corners, and for a shader, which
 *  may paint anywhere, the view's center. */
function painted(cmd: DrawCommand, m: GlMat3, rect: CullRect): Pt[] {
  if (cmd.kind === 'shader') return [{ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }];
  let pts: Pt[] = [];
  if (cmd.kind === 'path') {
    if (cmd.stroke) {
      const { cmd: resolved, spaces } = resolveStrokeLengths(m, cmd as StrokedPathCommand);
      pts = meshPoints(strokeMesh(cmd.path, resolved.stroke!, undefined, spaces));
    } else {
      pts = meshPoints(getMesh(cmd.path));
    }
  } else if (cmd.kind === 'image') {
    pts = [{ x: cmd.x, y: cmd.y }, { x: cmd.x + cmd.w, y: cmd.y }, { x: cmd.x + cmd.w, y: cmd.y + cmd.h }, { x: cmd.x, y: cmd.y + cmd.h }];
  }
  return pts.map((p) => { const [x, y] = mat3.apply(m, p.x, p.y); return { x, y }; });
}

const E = 1e-3;
const inBox = (p: Pt, b: ScreenBox, grow = 0): boolean =>
  p.x > b.minX - grow + E && p.x < b.maxX + grow - E && p.y > b.minY - grow + E && p.y < b.maxY + grow - E;

/**
 * Whether something `cmd` paints lands inside `rect`, or within `grow` of it under an effect that spreads it. A point
 * counts only inside every enclosing clip's box, and a point an effect spreads to only inside the boxes of the clips
 * around that effect. A clip around an effects group bounds its output, never the points inside: this claims less
 * than the truth, never more.
 */
function paintsInside(
  cmd: DrawCommand, m: GlMat3, rect: CullRect, dpr: number, clips: ScreenBox[] = [], grow = 0, outer: ScreenBox[] = [],
): boolean {
  if (cmd.kind === 'group') {
    const inner = cmd.transform ? mat3.multiply(m, cmd.transform) : m;
    if (cmd.effects && cmd.effects.length > 0) {
      grow += cmd.effects.every((e) => e.reach !== undefined) ? cmd.effects.reduce((n, e) => n + e.reach!, 0) / dpr : Infinity;
      outer = clips;
    }
    const within = cmd.clip ? [...clips, pathBox(cmd.clip, undefined, inner)!] : clips;
    return cmd.children.some((c) => paintsInside(c, inner, rect, dpr, within, grow, outer));
  }
  let region: ScreenBox = { minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height };
  for (const c of outer) {
    region = { minX: Math.max(region.minX, c.minX), minY: Math.max(region.minY, c.minY), maxX: Math.min(region.maxX, c.maxX), maxY: Math.min(region.maxY, c.maxY) };
  }
  if (region.maxX - region.minX <= 2 * E || region.maxY - region.minY <= 2 * E) {
    if (outer.length > 0) return false;
  }
  return painted(cmd, m, rect).some((p) => inBox(p, region, grow) && clips.every((c) => inBox(p, c)));
}

/** Check `out` is `cmds` with commands dropped and none reordered or changed, and that every command painting into
 *  `rect` stayed. */
export function checkCull(cmds: readonly DrawCommand[], out: readonly DrawCommand[], m: GlMat3, rect: CullRect, dpr: number,
  t: ReturnType<typeof tally>): void {
  let j = 0;
  for (const cmd of cmds) {
    const got = out[j];
    const kept = got !== undefined && (got === cmd || (cmd.kind === 'group' && got.kind === 'group' && sameButChildren(cmd, got)));
    const must = paintsInside(cmd, m, rect, dpr);
    if (must) {
      t.count(cmd.kind === 'group' ? 'group must stay' : m[0] === 1 && m[4] === 1 && m[6] === 0 ? 'leaf must stay' : 'moved leaf must stay');
      expect(kept, `dropped ${JSON.stringify(cmd)}`).toBe(true);
    }
    if (!kept) { t.count('dropped'); continue; }
    j++;
    if (got !== cmd && cmd.kind === 'group' && got.kind === 'group') {
      expect(got.children.length).toBeGreaterThan(0);
      checkCull(cmd.children, got.children, cmd.transform ? mat3.multiply(m, cmd.transform) : m, rect, dpr, t);
    }
  }
  expect(j, 'extra or reordered commands').toBe(out.length);
}

function sameButChildren(a: GroupDrawCommand, b: GroupDrawCommand): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('children');
  return [...keys].every((k) => (a as never)[k] === (b as never)[k]);
}

export const dpr = fc.constantFrom(1, 2, 0.5, 3);
