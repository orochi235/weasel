/**
 * `textHitAt` narrowed by the scene's pick index answers exactly what the full walk answers: the same node and
 * caret, or nothing, at every point of randomized scenes.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { pathFromD } from '@weasel-js/geom';
import { isTextData, loadTextOutlines, type TextOutlineSource } from '@weasel-js/text';
import { pathEffectNode } from 'core/scene/pathEffects/derive';
import { RIGID_POSE_COMPOSITION, IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { pickIndexBuildCount } from 'canvas/pickIndex/scenePickIndex';
import { rng } from 'canvas/pickIndex/pickIndexFixture';
import { PATH_EFFECT_DERIVATIONS, withPathEffectsRegistry } from '../pathEffects';
import { textHitAt, type TextReads } from './textHitAt';

const BARS: OutlineFace = {
  unitsPerEm: 1000, ascender: 0.8, advanceOf: () => 0.6, kernOf: () => 0, glyphD: () => 'M0 -0.5L0.2 -0.5L0.2 0L0 0Z',
};
const STYLE = { fontFamily: 'bars', fontSize: 30 };
const READ: TextReads<unknown> = {
  isText: isTextData,
  text: (d) => (d as { text: string }).text,
  style: (d) => (d as TextOutlineSource).style,
  runs: () => undefined,
  verticalAlign: () => undefined,
  padding: (d) => (d as { padding?: number }).padding,
};

type AnyScene = Scene<unknown, string, any>;

beforeEach(() => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
});

/** Text boxes, some turned, sheared or padded, some inside a turned frame, some locked or hidden, among shapes and
 *  text-along effects that hide their text, scattered over [0, 1000]². */
async function textScene(seed: number, composed: boolean): Promise<AnyScene> {
  registerFontOutlines('bars', {}, new ArrayBuffer(4), { parser: () => BARS });
  await loadTextOutlines({ text: 'Hello', style: STYLE, fill: { paint: { kind: 'solid', color: '#000' } } });
  const r = rng(seed);
  const scene = createScene<unknown, string, any>({
    systemLayers: [{ id: 'back' }, { id: 'main' }],
    registry: withPathEffectsRegistry(),
    composition: composed ? RIGID_POSE_COMPOSITION as never : IDENTITY_POSE_COMPOSITION,
  });
  const id = (s: string) => asNodeId(s);
  const at = () => ({ x: r() * 900, y: r() * 900 });
  const add = (spec: Record<string, unknown>) => scene.add({ kind: 'mark', layer: 'main', data: null, ...spec } as never);
  const text = (i: number) => ({ text: 'Hello'.slice(0, 1 + (i % 5)), style: STYLE, ...(i % 4 === 1 ? { padding: 6 } : {}) });
  for (let i = 0; i < 60; i++) {
    const { x, y } = at();
    const pose: Record<string, unknown> = { x, y, width: 20 + r() * 150, height: 20 + r() * 80 };
    if (i % 3 === 0) pose.rotation = r() * Math.PI * 2;
    if (i % 7 === 2) pose.transform = [1, 0.4, -0.2, 1.3];
    add({ id: id(`t${i}`), layer: i % 5 === 0 ? 'back' : 'main', pose, data: text(i) });
  }
  for (let i = 0; i < 30; i++) {
    const { x, y } = at();
    add({ id: id(`r${i}`), pose: { x, y, width: 10 + r() * 90, height: 10 + r() * 90 }, data: { shape: 'rect' } });
  }
  const frame = add({ id: id('frame'), kind: 'group', pose: { x: 300, y: 300, width: 300, height: 200, rotation: 0.6 }, clipFromPose: () => null });
  for (let i = 0; i < 6; i++) {
    add({ id: id(`f${i}`), parent: frame, pose: { x: 300 + i * 40, y: 310 + i * 20, width: 80, height: 30 }, data: text(i) });
  }
  for (let i = 0; i < 6; i++) {
    const { x, y } = at();
    const src = add({ id: id(`src${i}`), pose: { x, y, width: 200, height: 40 }, data: text(i + 2), hidden: i % 2 === 0 });
    const line = add({ id: id(`line${i}`), pose: { x, y: y + 60, width: 300, height: 1 }, data: { path: pathFromD(`M${x} ${y + 60} L${x + 300} ${y + 90}`) } });
    add({ ...pathEffectNode({ kind: 'textAlong', hideSources: i % 3 !== 2 }, [src, line], 'main', PATH_EFFECT_DERIVATIONS), id: id(`fx${i}`) });
  }
  scene.setLocked(id('t4'), true);
  scene.setLocked(id('src1'), true);
  scene.setHidden(id('t9'), true);
  scene.overrides.set(id('t12'), { pose: { x: 950, y: 40, width: 60, height: 30, rotation: 0.9 } });
  scene.overrides.set(id('t13'), { data: (d: unknown) => ({ ...(d as object), text: 'HelloHello' }) });
  scene.overrides.commit();
  return scene;
}

/** A view of `scene` whose version never repeats, so the pick index never builds and every hit walks in full. */
function unindexed(scene: AnyScene): AnyScene {
  let v = 0;
  return Object.assign(Object.create(scene) as AnyScene, { getVersion: () => --v });
}

/** Points scattered over the scene, on or just past a node's box edges, and over the glyphs laid along each line. */
function points(scene: AnyScene, seed: number): [number, number][] {
  const r = rng(seed);
  const boxes = scene.renderOrderNodes().map((n) => n.pose as { x: number; y: number; width: number; height: number });
  const out: [number, number][] = [];
  for (let i = 0; i < 400; i++) {
    if (i % 2 === 0) {
      out.push([r() * 1100 - 50, r() * 1100 - 50]);
      continue;
    }
    const b = boxes[Math.floor(r() * boxes.length)];
    out.push([b.x + (r() < 0.5 ? 0 : b.width) + (r() * 2 - 1) * 3, b.y + r() * b.height]);
  }
  const lines = scene.renderOrderNodes().filter((n) => String(n.id).startsWith('line'));
  for (let i = 0; i < 200; i++) {
    const { x, y } = lines[i % lines.length].pose as { x: number; y: number };
    const t = r();
    out.push([x + t * 300, y + t * 30 - r() * 20]);
  }
  return out;
}

describe('textHitAt through the pick index', () => {
  for (const composed of [false, true]) {
    for (const seed of [1, 2, 3]) {
      it(`answers as the full walk does (seed ${seed}${composed ? ', composed frames' : ''})`, async () => {
        const scene = await textScene(seed, composed);
        const linear = unindexed(scene);
        const pts = points(scene, seed * 31);
        textHitAt(scene, READ, 0, 0);
        const built = pickIndexBuildCount();
        let hits = 0;
        for (const [x, y] of pts) {
          const want = textHitAt(linear, READ, x, y);
          if (want) hits++;
          expect(textHitAt(scene, READ, x, y), `(${x}, ${y})`).toEqual(want);
        }
        // The index built once, on the second hit, and served the rest.
        expect(pickIndexBuildCount()).toBe(built + 1);
        expect(hits).toBeGreaterThan(40);
      });
    }
  }
});
