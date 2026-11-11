/**
 * Properties of a lens's pure geometry and pixels: the patch a body magnifies, a split body's two halves, a selected
 * body's interior, and the Difference view's pixels against a brute-force reading of the two captures.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { splitRects } from './compare';
import { diffPixels } from './difference';
import { HANDLE_SLOP, interiorOf } from './lensHitBoxes';
import { patchAt } from './lensScene';

const RUNS = 200;

const coord = fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true });
const extent = fc.double({ min: 0, max: 2000, noNaN: true, noDefaultInfinity: true });
const close = (a: number, b: number, ...scale: number[]) =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b), ...scale.map(Math.abs));

describe("a lens's patch", () => {
  it(
    'is the body divided by its factor, centered where it aims',
    () => {
      fc.assert(
        fc.property(
          fc.record({ x: coord, y: coord, width: extent, height: extent }),
          fc.double({ min: 0.01, max: 64, noNaN: true }),
          fc.record({ x: coord, y: coord }),
          (body, factor, at) => {
            const p = patchAt(body, factor, at);
            expect(close(p.width * factor, body.width)).toBe(true);
            expect(close(p.height * factor, body.height)).toBe(true);
            expect(close(p.x + p.width / 2, at.x, p.width)).toBe(true);
            expect(close(p.y + p.height / 2, at.y, p.height)).toBe(true);
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe("a split body's halves", () => {
  it(
    'tile its interior either side of a seam on a whole pixel inside it',
    () => {
      const px = fc.integer({ min: -500, max: 500 });
      fc.assert(
        fc.property(
          fc.record({ x: px, y: px, w: fc.nat(800), h: fc.nat(800) }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          (interior, seam) => {
            const { left, right, seamX } = splitRects(interior, seam);
            expect(Number.isInteger(seamX)).toBe(true);
            expect(seamX).toBeGreaterThanOrEqual(interior.x);
            expect(seamX).toBeLessThanOrEqual(interior.x + interior.w);
            expect(left.x).toBe(interior.x);
            expect(left.x + left.w).toBe(seamX);
            expect(right.x).toBe(seamX);
            expect(right.x + right.w).toBe(interior.x + interior.w);
            expect(left.w).toBeGreaterThanOrEqual(0);
            expect(right.w).toBeGreaterThanOrEqual(0);
            for (const half of [left, right]) {
              expect(half.y).toBe(interior.y);
              expect(half.h).toBe(interior.h);
            }
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );

  it(
    "a selected body's interior is its hit box less the slop on every side",
    () => {
      fc.assert(
        fc.property(
          fc.record({ x: coord, y: coord, w: extent, h: extent }),
          fc.boolean(),
          (rect, grown) => {
            const inner = interiorOf(rect, grown);
            if (!grown) {
              expect(inner).toBe(rect);
              return;
            }
            expect(close(inner.x - HANDLE_SLOP, rect.x)).toBe(true);
            expect(close(inner.x + inner.w + HANDLE_SLOP, rect.x + rect.w)).toBe(true);
            expect(close(inner.y + inner.h + HANDLE_SLOP, rect.y + rect.h)).toBe(true);
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 1),
  );
});

describe('the Difference view', () => {
  const capture = (w: number, h: number) =>
    fc
      .uint8Array({ minLength: w * h * 4, maxLength: w * h * 4 })
      .map((bytes) => new ImageData(new Uint8ClampedArray(bytes), w, h));
  // Channels drawn from few values, so equal and nearly equal pixels come up.
  const nearly = (img: ImageData) =>
    fc
      .array(
        fc.oneof(
          fc.constant(0),
          fc.integer({ min: -3, max: 3 }),
          fc.integer({ min: -255, max: 255 }),
        ),
        {
          minLength: img.data.length,
          maxLength: img.data.length,
        },
      )
      .map(
        (nudge) =>
          new ImageData(
            Uint8ClampedArray.from(img.data, (v, i) => v + (nudge[i] as number)),
            img.width,
            img.height,
          ),
      );
  const pair = fc
    .tuple(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }))
    .chain(([w, h]) => capture(w, h).chain((a) => fc.tuple(fc.constant(a), nearly(a))));

  it(
    'lights exactly the pixels some channel of which differs past the tolerance, and dims the rest',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          pair,
          fc.integer({ min: 0, max: 8 }),
          fc.double({ min: 0, max: 1, noNaN: true }),
          ([a, b], tolerance, dim) => {
            const lit = [10, 200, 30] as const;
            const { image, changed } = diffPixels(a, b, { tolerance, lit, dim });
            expect(diffPixels(b, a, { tolerance }).changed).toBe(changed);
            let count = 0;
            for (let i = 0; i < a.data.length; i += 4) {
              const differs = [0, 1, 2, 3].some(
                (c) => Math.abs((a.data[i + c] as number) - (b.data[i + c] as number)) > tolerance,
              );
              const got = Array.from(image.data.subarray(i, i + 4));
              if (differs) {
                count += 1;
                expect(got).toEqual([...lit, 255]);
              } else {
                expect(got).toEqual([
                  a.data[i],
                  a.data[i + 1],
                  a.data[i + 2],
                  Math.round((a.data[i + 3] as number) * dim),
                ]);
              }
            }
            expect(changed).toBe(count);
            t.count(
              count === 0
                ? 'none differ'
                : count * 4 === a.data.length
                  ? 'all differ'
                  : 'some differ',
            );
          },
        ),
        runs(RUNS),
      );
      t.atLeast('some differ', RUNS / 4);
    },
    timeoutFor(RUNS, 2),
  );

  it(
    'refuses two captures of different sizes',
    () => {
      fc.assert(
        fc.property(
          fc.tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 })),
          fc.tuple(fc.integer({ min: 1, max: 4 }), fc.integer({ min: 1, max: 4 })),
          ([w, h], [v, u]) => {
            fc.pre(w !== v || h !== u);
            const a = new ImageData(new Uint8ClampedArray(w * h * 4), w, h);
            const b = new ImageData(new Uint8ClampedArray(v * u * 4), v, u);
            expect(() => diffPixels(a, b)).toThrow(/diffPixels: size/);
          },
        ),
        runs(RUNS / 4),
      );
    },
    timeoutFor(RUNS, 1),
  );
});
