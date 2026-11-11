/**
 * Property tests of what the page renders from what Node sends: a scene of random marks, sent and revived as the
 * page revives it, plans the same render as the scene itself, alike every time, and sends as the same bytes again;
 * sending reads the caller's scene and leaves it as it was; and a request is refused in Node exactly when
 * `renderSceneToPixels` would refuse its rect and scale in the page, so a request that cannot render never starts a
 * browser.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createScene, pathFromD, planPixelRender, sceneFromJSON, type RectPose, type SavedScene } from '@weasel-js/core';
import { tagTypedArrays } from '@weasel-js/geom';
import { readPageRequest, sceneFromWire, sceneToWire } from './protocol';

function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}
const timeoutFor = (n: number, msPerRun: number): number => Math.max(5_000, runs(n).numRuns * msPerRun);

const n = fc.double({ min: -200, max: 200, noNaN: true });
const color = fc.constantFrom('#d03030', '#00a0ff80', 'transparent', 'rgb(1, 2, 3)');
const mark = fc.record({
  x: n, y: n, width: fc.double({ min: 0, max: 100, noNaN: true }), height: fc.double({ min: 0, max: 100, noNaN: true }),
  shape: fc.constantFrom('rect', 'ellipse', 'star', 'path'), fill: fc.option(color, { nil: undefined }),
  stroke: fc.option(fc.tuple(color, fc.double({ min: 0, max: 5, noNaN: true })), { nil: undefined }),
  name: fc.constantFrom('a', '__proto__', 'constructor', 'é😀'),
});

type Mark = typeof mark extends fc.Arbitrary<infer T> ? T : never;

function sceneOf(marks: Mark[]) {
  const scene = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const m of marks) {
    const style = {
      ...(m.fill ? { fill: { paint: { color: m.fill } } } : {}),
      ...(m.stroke ? { stroke: { paint: { color: m.stroke[0] }, width: m.stroke[1] } } : {}),
    };
    const data = m.shape === 'path'
      ? { path: pathFromD('M0 20 C10 -10 40 30 50 0'), ...style }
      : { shape: m.shape, points: 5, ...style };
    // Defined, as JSON.parse would, so a `__proto__` key is the data's own.
    Object.defineProperty(data, m.name, { value: m.x, enumerable: true, writable: true, configurable: true });
    scene.add({ kind: 'mark', layer: 'main', pose: { x: m.x, y: m.y, width: m.width, height: m.height }, data });
  }
  return scene;
}

const rect = { sourceRect: { x: -50, y: -50, width: 300, height: 200 }, scale: { x: 0.75, y: 1.25 } };

describe('a scene sent to the page', () => {
  it('plans the render the scene itself plans, alike every time, and sends as the same bytes again', () => {
    fc.assert(fc.property(fc.array(mark, { maxLength: 6 }), (marks) => {
      const scene = sceneOf(marks);
      const before = JSON.stringify(sceneToWire(scene));
      const wire = JSON.parse(before) as object;
      const revived = sceneFromJSON(sceneFromWire(wire) as SavedScene<unknown, string, unknown>);
      const own = planPixelRender({ scene, ...rect });
      expect(planPixelRender({ scene: revived, ...rect })).toEqual(own);
      expect(planPixelRender({ scene, ...rect })).toEqual(own);
      expect(JSON.stringify(sceneToWire(revived))).toBe(before);
      expect(JSON.stringify(sceneToWire(scene))).toBe(before);
    }), runs(100));
  }, timeoutFor(100, 30));

  it('leaves the snapshot it is handed as it was', () => {
    fc.assert(fc.property(fc.array(mark, { maxLength: 4 }), (marks) => {
      const snapshot = sceneOf(marks).toJSON();
      const written = JSON.stringify(tagTypedArrays(snapshot));
      sceneToWire(snapshot);
      sceneFromWire(sceneToWire(snapshot));
      expect(JSON.stringify(tagTypedArrays(snapshot))).toBe(written);
    }), runs(100));
  }, timeoutFor(100, 10));
});

describe('a request Node sends', () => {
  const edge = fc.oneof(
    fc.constantFrom(0, -0, -1, 1, 1e-300, -1e-300, Number.MIN_VALUE, 1e300, -1e300),
    fc.double({ min: -50, max: 50, noNaN: true }),
  );
  it('is refused exactly when the page would refuse its rect and scale', () => {
    let refused = 0;
    let read = 0;
    const empty = createScene<unknown, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    fc.assert(fc.property(fc.record({ x: edge, y: edge, width: edge, height: edge }), fc.record({ x: edge, y: edge }), (sourceRect, scale) => {
      let page: unknown;
      try {
        planPixelRender({ scene: empty, sourceRect, scale });
      } catch (err) {
        page = err;
      }
      const node = (() => {
        try {
          readPageRequest({ scene: {}, sourceRect, scale, format: 'rgba' });
          return undefined;
        } catch (err) {
          return err;
        }
      })();
      expect(node !== undefined, `page: ${String(page)}; node: ${String(node)}`).toBe(page !== undefined);
      if (node) refused++;
      else read++;
    }), runs(400));
    expect(refused).toBeGreaterThan(50);
    expect(read).toBeGreaterThan(50);
  }, timeoutFor(400, 1));
});
