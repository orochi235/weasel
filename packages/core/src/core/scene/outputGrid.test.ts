/**
 * A scene's quantize rule keeps the document on its output grid on every
 * write, re-snaps when the grid changes inside that same undo entry, and
 * moves what is drawn without moving what is hit. Resize: `resize.quantize.test.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { alignToGrid, snapToPitch, type OutputGrid } from '@weasel-js/geom';
import { createTransformOp } from 'core/ops/transform';
import { buildSceneViewCommands } from 'canvas/sceneViewRender';
import { createScene } from './scene';
import { asNodeId, type RectPose, type Scene } from './types';
import type { QuantizeRule } from './useSceneOptions';
import { OUTPUT_GRID_KEY, quantizeSize } from './outputGrid';

type Data = { kind: 'box' | 'stroke' | 'free'; strokeWidth?: number };
type S = Scene<Data, 'main', RectPose>;

const GRID: OutputGrid = { pitch: 0.4, origin: { x: 0, y: 0 } };
const dots = (v: number, grid = GRID) => v / grid.pitch;
const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;

const RULE: QuantizeRule<Data, RectPose> = {
  stored({ data, pose }, grid, anchor) {
    if (data.kind === 'box') {
      return { pose: quantizeSize(pose, snapToPitch(pose.width, grid.pitch), snapToPitch(pose.height, grid.pitch), anchor) };
    }
    if (data.kind === 'stroke' && data.strokeWidth !== undefined) {
      return { data: { ...data, strokeWidth: snapToPitch(data.strokeWidth, grid.pitch) } };
    }
    return null;
  },
  drawn: ({ data, pose }, grid) => (data.kind === 'box' ? alignToGrid(pose, grid) : pose),
};

const BOX = asNodeId('box');
const STROKE = asNodeId('stroke');
const FREE = asNodeId('free');
const ODD: RectPose = { x: 1.13, y: 2.07, width: 10.1, height: 0.1 };

function makeScene(grid: OutputGrid | null = GRID): S {
  const scene = createScene<Data, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    quantize: RULE,
    ...(grid ? { doc: { [OUTPUT_GRID_KEY]: grid } } : {}),
  });
  scene.add({ id: BOX, kind: 'mark', layer: 'main', data: { kind: 'box' }, pose: ODD });
  scene.add({ id: STROKE, kind: 'mark', layer: 'main', data: { kind: 'stroke', strokeWidth: 0.5 }, pose: ODD });
  scene.add({ id: FREE, kind: 'mark', layer: 'main', data: { kind: 'free' }, pose: ODD });
  scene.history.clear();
  return scene;
}

afterEach(() => vi.restoreAllMocks());

describe('the quantize pass', () => {
  it('snaps an insert, and leaves a node the rule returns null for untouched', () => {
    const scene = makeScene();
    const box = scene.get(BOX)!.pose;
    expect(box).toMatchObject({ x: ODD.x, y: ODD.y });
    expect(dots(box.width)).toBeCloseTo(25, 9);
    expect(dots(box.height)).toBeCloseTo(1, 9);
    expect(scene.get(STROKE)!.data.strokeWidth).toBeCloseTo(0.4, 9);
    expect(scene.get(FREE)!.pose).toEqual(ODD);
  });

  it('snaps a setPose and an op batch, in the edit’s own undo entry', () => {
    const scene = makeScene();
    const before = scene.get(BOX)!.pose;
    scene.setPose(BOX, { ...before, width: 3.3 });
    expect(dots(scene.get(BOX)!.pose.width)).toBeCloseTo(8, 9);
    scene.applyBatch([createTransformOp({ id: BOX, from: scene.get(BOX)!.pose, to: { ...before, height: 2.1 } })], 'Size', {
      setPose: (id: string, pose: RectPose) => scene.setPose(asNodeId(id), pose),
    });
    expect(dots(scene.get(BOX)!.pose.height)).toBeCloseTo(5, 9);
    expect(scene.historyEntries()).toHaveLength(2);
    scene.undo();
    scene.undo();
    expect(scene.get(BOX)!.pose).toEqual(before);
  });

  it('snaps a data edit: a stroke width', () => {
    const scene = makeScene();
    scene.update(STROKE, { data: { kind: 'stroke', strokeWidth: 1.7 } });
    expect(scene.get(STROKE)!.data.strokeWidth).toBeCloseTo(1.6, 9);
  });

  it('snaps a document it loads', () => {
    const scene = makeScene(null);
    const json = scene.toJSON();
    const loaded = makeScene();
    loaded.loadState({ ...json, doc: { [OUTPUT_GRID_KEY]: GRID } });
    expect(scene.get(BOX)!.pose).toEqual(ODD);
    expect(dots(loaded.get(BOX)!.pose.width)).toBeCloseTo(25, 9);
  });

  it('re-snaps every node when the grid changes, and one undo restores the grid and the values', () => {
    const scene = makeScene();
    const before = { box: scene.get(BOX)!.pose, stroke: scene.get(STROKE)!.data };
    const finer: OutputGrid = { pitch: 72 / 300, origin: { x: 0, y: 0 } };
    scene.doc.set(OUTPUT_GRID_KEY, finer);
    expect(whole(dots(scene.get(BOX)!.pose.width, finer))).toBe(true);
    expect(whole(dots(scene.get(STROKE)!.data.strokeWidth!, finer))).toBe(true);
    expect(scene.historyEntries()).toHaveLength(1);
    scene.undo();
    expect(scene.doc.get(OUTPUT_GRID_KEY)).toEqual(GRID);
    expect(scene.get(BOX)!.pose).toEqual(before.box);
    expect(scene.get(STROKE)!.data).toEqual(before.stroke);
  });

  it('stops when the grid is cleared, and changes no stored value', () => {
    const scene = makeScene();
    const box = scene.get(BOX)!.pose;
    scene.doc.set(OUTPUT_GRID_KEY, undefined);
    expect(scene.get(BOX)!.pose).toEqual(box);
    scene.setPose(BOX, ODD);
    expect(scene.get(BOX)!.pose).toEqual(ODD);
  });

  it('warns in development when `stored` is not idempotent', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = createScene<Data, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      quantize: { stored: ({ pose }) => ({ pose: { ...pose, x: pose.x + 1 } }) },
      doc: { [OUTPUT_GRID_KEY]: GRID },
    });
    scene.add({ id: BOX, kind: 'mark', layer: 'main', data: { kind: 'box' }, pose: ODD });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not idempotent'), expect.anything());
  });
});

describe('the drawn pose', () => {
  it('moves what is drawn, and not what is hit', () => {
    const scene = makeScene();
    const seen: RectPose[] = [];
    buildSceneViewCommands(scene, { x: 0, y: 0, scale: { x: 1, y: 1 } }, (node, pose) => {
      if (node.id === BOX) seen.push(pose);
      return [];
    });
    expect(seen).toHaveLength(1);
    expect(whole(dots(seen[0]!.x))).toBe(true);
    expect(whole(dots(seen[0]!.y))).toBe(true);
    expect(scene.get(BOX)!.pose).toMatchObject({ x: ODD.x, y: ODD.y });
  });
});
