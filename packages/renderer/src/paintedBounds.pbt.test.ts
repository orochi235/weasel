import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3, type GlMat3, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { scaleVertexWidth } from '@weasel-js/paint';
import { ribbonAligns } from '@weasel-js/stroke';
import { getMesh } from './cache/cache';
import { strokeMesh } from './cache/strokeMeshCache';
import { SPRITE_STRIDE } from './DrawCommand';
import { pathBox, paintedBox, type ScreenBox } from './paintedBounds';
import { resolveStrokeLengths, type StrokedPathCommand } from './strokeLengths';
import { affine, anyPath, eighth, meshPoints, runs, stroke, tally, timeoutFor, type Pt } from './pbt.fixture';

const PAINT = { kind: 'solid' as const, color: '#000' };

/** What the renderer tessellates for `stroke` on `path` under `m`: the ribbon, or for an inner or outer stroke it
 *  cannot shift, the centered one twice as wide that it cuts to its side. */
function ribbonPoints(path: Path, s: Stroke, m: GlMat3): Pt[] {
  const raw = { kind: 'path', path, stroke: { ...s, paint: PAINT } } as StrokedPathCommand;
  const { cmd, spaces } = resolveStrokeLengths(m, raw);
  let st: Stroke = cmd.stroke;
  const align = st.align ?? 'center';
  if (align !== 'center' && !ribbonAligns(path, st, spaces.ribbon?.metric)) {
    st = {
      ...st, width: (st.width as number) * 2, align: 'center',
      ...(st.vertexWidths ? { vertexWidths: st.vertexWidths.map((w) => scaleVertexWidth(w, 2)) } : {}),
    };
  }
  return meshPoints(strokeMesh(path, st, undefined, spaces));
}

function within(box: ScreenBox, x: number, y: number, slack: number): boolean {
  return x >= box.minX - slack && x <= box.maxX + slack && y >= box.minY - slack && y <= box.maxY + slack;
}

/** Float32 mesh vertices, carried through `m`: the slack their rounding can move them on screen. */
function slackOf(box: ScreenBox, m: GlMat3): number {
  const big = Math.max(Math.abs(box.minX), Math.abs(box.maxX), Math.abs(box.minY), Math.abs(box.maxY), 1);
  return 1e-5 * big + 1e-4 * (Math.abs(m[0]) + Math.abs(m[1]) + Math.abs(m[3]) + Math.abs(m[4]));
}

describe('pathBox, property', () => {
  it('holds every vertex of the fill and of the ribbon the renderer tessellates, under any transform', () => {
    const t = tally();
    fc.assert(fc.property(anyPath, stroke, affine, (path, s, m) => {
      const box = pathBox(path, s, m);
      if (box === null) return;
      const slack = slackOf(box, m);
      const ribbon = ribbonPoints(path, s, m);
      t.count(ribbon.length > 0 ? `${path.kind}:${s.align}` : 'no ribbon');
      for (const p of [...meshPoints(getMesh(path)), ...ribbon]) {
        const [x, y] = mat3.apply(m, p.x, p.y);
        expect(within(box, x, y, slack), `(${x}, ${y}) outside ${JSON.stringify(box)}`).toBe(true);
      }
    }), runs(200));
    for (const k of ['rect:center', 'rect:outer', 'rect:inner', 'polygon:center', 'polygon:outer', 'polygon:inner']) t.atLeast(k, 8);
  }, timeoutFor(200, 20));

  it('moves with a translation applied after the transform', () => {
    fc.assert(fc.property(anyPath, fc.option(stroke, { nil: undefined }), affine, eighth(1000), eighth(1000), (path, s, m, tx, ty) => {
      const moved = mat3.fromAffine([m[0], m[1], m[3], m[4], m[6] + tx, m[7] + ty]);
      const a = pathBox(path, s, m)!, b = pathBox(path, s, moved)!;
      const tol = 1e-9 * (1 + Math.abs(tx) + Math.abs(ty) + Math.abs(a.minX) + Math.abs(a.maxX) + Math.abs(a.minY) + Math.abs(a.maxY));
      expect(Math.abs(b.minX - a.minX - tx)).toBeLessThanOrEqual(tol);
      expect(Math.abs(b.maxX - a.maxX - tx)).toBeLessThanOrEqual(tol);
      expect(Math.abs(b.minY - a.minY - ty)).toBeLessThanOrEqual(tol);
      expect(Math.abs(b.maxY - a.maxY - ty)).toBeLessThanOrEqual(tol);
    }), runs(300));
  });

  it('grows with the stroke: no stroke bounds no more than any stroke', () => {
    fc.assert(fc.property(anyPath, stroke, affine, (path, s, m) => {
      const bare = pathBox(path, undefined, m)!, stroked = pathBox(path, s, m)!;
      expect(stroked.minX).toBeLessThanOrEqual(bare.minX);
      expect(stroked.minY).toBeLessThanOrEqual(bare.minY);
      expect(stroked.maxX).toBeGreaterThanOrEqual(bare.maxX);
      expect(stroked.maxY).toBeGreaterThanOrEqual(bare.maxY);
    }), runs(300));
  });
});

describe('paintedBox, property', () => {
  it('holds an image quad\'s corners, and every sprite\'s, under any transform', () => {
    const quad = fc.tuple(eighth(), eighth(), eighth(100), eighth(100));
    fc.assert(fc.property(quad, fc.array(quad, { maxLength: 5 }), affine, ([x, y, w, h], sprites, m) => {
      const image = paintedBox({ kind: 'image', x, y, w, h } as never, m)!;
      const data = new Float32Array(sprites.length * SPRITE_STRIDE);
      sprites.forEach((q, i) => data.set(q, i * SPRITE_STRIDE));
      const sheet = paintedBox({ kind: 'sprites', sprites: data } as never, m)!;
      if (sprites.length === 0) expect(sheet.minX).toBe(Infinity);
      const check = (box: ScreenBox, [qx, qy, qw, qh]: readonly number[]): void => {
        for (const [px, py] of [[qx, qy], [qx + qw, qy], [qx + qw, qy + qh], [qx, qy + qh]] as const) {
          const [sx, sy] = mat3.apply(m, px!, py!);
          expect(within(box, sx, sy, 1e-9 * (1 + Math.abs(sx) + Math.abs(sy)))).toBe(true);
        }
      };
      check(image, [x, y, w, h]);
      for (const q of sprites) check(sheet, q);
    }), runs(300));
  });
});
