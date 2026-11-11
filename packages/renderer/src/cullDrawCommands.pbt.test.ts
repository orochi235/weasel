import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3 } from '@weasel-js/geom';
import { pathBox, type ScreenBox } from './paintedBounds';
import { getMesh } from './cache/cache';
import { strokeMesh } from './cache/strokeMeshCache';
import { boundsMissRect, cullDrawCommands, type CullRect } from './cullDrawCommands';
import type { DrawCommand, GroupDrawCommand } from './DrawCommand';
import { resolveStrokeLengths, type StrokedPathCommand } from './strokeLengths';
import { affine, anyPath, eighth, meshPoints, rectPath, runs, spread, tally, timeoutFor, type Pt } from './pbt.fixture';

const PAINT = { kind: 'solid' as const, color: '#000' };
const IMAGE = {} as ImageBitmap;
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
const near = fc.oneof(fc.constant(mat3.identity()), affine.map((m) => {
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
    }).map(({ children, transform, clip, composite, reach }): DrawCommand => ({
      kind: 'group', children,
      ...(transform ? { transform } : {}),
      // A clip on an effects group bounds its output, which the oracle below does not model.
      ...(clip && reach === null ? { clip } : {}),
      ...(composite ? { composite } : {}),
      ...(reach !== null ? { effects: [{ program: PROGRAM, ...(reach === undefined ? {} : { reach }) }] } : {}),
    })),
  ),
}));

/** Each command tagged apart, so a group the cull copies is still told from its neighbors. */
const tree = rawTree.map((cmds) => {
  let n = 0;
  const tag = (list: DrawCommand[]): DrawCommand[] => list.map((c) => ({
    ...c, pbt: n++, ...(c.kind === 'group' ? { children: tag(c.children) } : {}),
  }) as DrawCommand);
  return tag(cmds);
});

const view: fc.Arbitrary<CullRect> = fc.record({
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
 * counts only inside every enclosing clip's box. Cull ignores a clip outside an effects group, and one outside the
 * effects bounds its output rather than the point; either way this claims less than the truth, never more.
 */
function paintsInside(cmd: DrawCommand, m: GlMat3, rect: CullRect, dpr: number, clips: ScreenBox[] = [], grow = 0): boolean {
  if (cmd.kind === 'group') {
    if (cmd.effects && cmd.effects.length > 0) {
      grow += cmd.effects.every((e) => e.reach !== undefined) ? cmd.effects.reduce((n, e) => n + e.reach!, 0) / dpr : Infinity;
    }
    const inner = cmd.transform ? mat3.multiply(m, cmd.transform) : m;
    const within = cmd.clip ? [...clips, pathBox(cmd.clip, undefined, inner)!] : clips;
    return cmd.children.some((c) => paintsInside(c, inner, rect, dpr, within, grow));
  }
  const view = { minX: rect.x, minY: rect.y, maxX: rect.x + rect.width, maxY: rect.y + rect.height };
  return painted(cmd, m, rect).some((p) => inBox(p, view, grow) && clips.every((c) => inBox(p, c)));
}

/** Check `out` is `cmds` with commands dropped and none reordered or changed, and that every command painting into
 *  `rect` stayed. */
function checkCull(cmds: readonly DrawCommand[], out: readonly DrawCommand[], m: GlMat3, rect: CullRect, dpr: number,
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

const dpr = fc.constantFrom(1, 2, 0.5, 3);

describe('cullDrawCommands, property', () => {
  it('drops commands without reordering or changing the rest, and keeps every one that paints in view', () => {
    const t = tally();
    fc.assert(fc.property(tree, near, view, dpr, (cmds, m, rect, d) => {
      const out = cullDrawCommands(cmds, m, rect, d);
      checkCull(cmds, out, m, rect, d, t);
    }), runs(1000));
    t.atLeast('leaf must stay', 25);
    t.atLeast('moved leaf must stay', 25);
    t.atLeast('group must stay', 100);
    t.atLeast('dropped', 200);
  }, timeoutFor(1000, 10));

  it('returns its input when it drops nothing, and is idempotent', () => {
    const t = tally();
    fc.assert(fc.property(tree, near, view, dpr, (cmds, m, rect, d) => {
      const out = cullDrawCommands(cmds, m, rect, d);
      t.count(out === cmds ? 'same' : 'culled');
      expect(cullDrawCommands(out, m, rect, d)).toBe(out);
    }), runs(300));
    t.atLeast('same', 30);
    t.atLeast('culled', 30);
  }, timeoutFor(300, 10));

  it('drops an image exactly when boundsMissRect says its rect misses', () => {
    const t = tally();
    fc.assert(fc.property(fc.tuple(spread(-300, 300), spread(-300, 300), spread(-200, 200), spread(-200, 200)), near, view, ([x, y, w, h], m, rect) => {
      const cmd: DrawCommand = { kind: 'image', image: IMAGE, x, y, w, h };
      const miss = boundsMissRect({ x, y, width: w, height: h }, m, rect);
      t.count(miss ? 'miss' : 'meet');
      expect(cullDrawCommands([cmd], m, rect, 1).length).toBe(miss ? 0 : 1);
    }), runs(300));
    t.atLeast('miss', 30);
    t.atLeast('meet', 8);
  });
});
