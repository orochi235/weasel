import { describe, expect, it } from 'vitest';
import { OUTPUT_GRID_KEY, buildSceneViewCommands, createScene, type RectPose } from '@weasel-js/core';
import {
  BARS, DOT_RULE, INITIAL_NODES, MODULE, outputGrid,
  type DitherLayer, type DitherNodeData,
} from '../ditherDemoScene';

const whole = (v: number) => Math.abs(v - Math.round(v)) < 1e-9;
const MODULES = BARS.reduce((a, b) => a + b, 0);

function onDots(dpi: number) {
  return createScene<DitherNodeData, DitherLayer, RectPose>({
    systemLayers: [{ id: 'art' }, { id: 'marks' }],
    initial: INITIAL_NODES,
    quantize: DOT_RULE,
    doc: { [OUTPUT_GRID_KEY]: outputGrid(dpi) },
  });
}
const marks = (scene: ReturnType<typeof onDots>) => [...scene.nodes.values()].filter((n) => n.data.mark);

describe('the dither demo on the output grid', () => {
  for (const dpi of [180, 300]) {
    it(`stores the barcode at its modules times a whole-dot module, and each rule at whole dots, at ${dpi} dpi`, () => {
      const { pitch } = outputGrid(dpi);
      const scene = onDots(dpi);
      for (const n of marks(scene)) {
        expect(whole(n.pose.height / pitch)).toBe(true);
        expect(n.pose.height / pitch).toBeGreaterThanOrEqual(1 - 1e-9);
        if (n.data.mark === 'barcode') {
          expect(n.pose.width / pitch).toBeCloseTo(MODULES * Math.max(1, Math.round(MODULE / pitch)), 9);
        } else {
          expect(whole(n.pose.width / pitch)).toBe(true);
        }
      }
    });
  }

  it('draws every mark with its corner on a dot, where its stored corner is not', () => {
    const scene = onDots(300);
    const { pitch } = outputGrid(300);
    const drawn = new Map<string, RectPose>();
    buildSceneViewCommands(scene, { x: 0, y: 0, scale: { x: 1, y: 1 } }, (node, pose) => {
      drawn.set(node.id, pose);
      return [];
    });
    for (const n of marks(scene)) {
      const at = drawn.get(n.id)!;
      expect(whole(at.x / pitch) && whole(at.y / pitch)).toBe(true);
    }
    expect(marks(scene).some((n) => !whole(n.pose.x / pitch))).toBe(true);
  });

  it('re-snaps the barcode when the grid changes, and one undo puts it back', () => {
    const scene = onDots(180);
    const barcode = marks(scene).find((n) => n.data.mark === 'barcode')!;
    const at180 = barcode.pose.width;
    scene.doc.set(OUTPUT_GRID_KEY, outputGrid(300));
    expect(scene.get(barcode.id)!.pose.width / (72 / 300)).toBeCloseTo(MODULES * 2, 9);
    scene.undo();
    expect(scene.get(barcode.id)!.pose.width).toBe(at180);
  });
});
