import { describe, expect, it, vi } from 'vitest';
import { bitmapSrc, createScene, reconcileSpecs, type RectPose } from '@weasel-js/core';
import { diagramScene, SLOT_FRAME, type DiagramSceneData, type DiagramSpec } from '../fromData';
import { PREVIEW_SIZE, previewRowId, type EffectLook, type RunRowOptions } from './draw';
import { lanes } from './lanes';
import { nodeGraph } from './nodeGraph';
import { rack } from './rack';
import { paintRun } from './run';
import type { EffectPipeline, EffectRun } from './types';

const PIPELINE: EffectPipeline = {
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [{ id: 'out', type: 'image' }] },
    { id: 'blur', title: 'Blur', inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }, { id: 'mask', type: 'image' }] },
    { id: 'tail', title: 'Tail', inputs: [{ id: 'in', type: 'image' }], outputs: [{ id: 'out', type: 'image' }] },
  ],
  wires: [
    { from: { stage: 'src', port: 'out' }, to: { stage: 'blur', port: 'in' } },
    { from: { stage: 'blur', port: 'out' }, to: { stage: 'tail', port: 'in' } },
  ],
};

const bitmap = (): ImageBitmap => ({ width: 8, height: 8, close() {} }) as unknown as ImageBitmap;

const built = (options: RunRowOptions = { showPreviews: true }, look: EffectLook<RunRowOptions> = nodeGraph) => {
  const drawn = look(PIPELINE, options);
  return diagramScene(drawn.data, drawn.scene);
};
const byId = (specs: readonly DiagramSpec[], id: string) => specs.find((s) => s.id === id);
const slot = (stage: string, port: string) => `${stage}/${previewRowId(port)}`;
const runWith = (previews: Record<string, ImageBitmap>): EffectRun =>
  ({ stages: { src: {}, blur: { previews } } });

describe('showPreviews', () => {
  it('keeps a slot per output on every look, as an empty frame the preview size', () => {
    for (const look of [nodeGraph, rack, lanes] as EffectLook<RunRowOptions>[]) {
      const specs = built({ showPreviews: true }, look);
      for (const id of [slot('src', 'out'), slot('blur', 'out'), slot('blur', 'mask'), slot('tail', 'out')]) {
        const spec = byId(specs, id);
        expect(spec, `${id} on ${look.name}`).toBeDefined();
        expect(spec!.pose, `${id} on ${look.name}`).toMatchObject({ width: PREVIEW_SIZE, height: PREVIEW_SIZE });
        expect(spec!.data.diagram).toEqual({ mark: { d: SLOT_FRAME } });
      }
    }
  });

  it('keeps none when off', () => {
    expect(built({}).some((s) => (s.id as string).includes('/preview:'))).toBe(false);
  });

  it('sizes a slot from previewSize', () => {
    const specs = built({ showPreviews: true, previewSize: { width: 64, height: 36 } });
    expect(byId(specs, slot('blur', 'out'))!.pose).toMatchObject({ width: 64, height: 36 });
  });

  it('puts each output\'s slot after its value row', () => {
    const ids = built({ showPreviews: true, showValues: true }).filter((s) => s.parent === 'blur').map((s) => s.id);
    expect(ids.indexOf('blur/preview:out')).toBe(ids.indexOf('blur/value:out') + 1);
    expect(ids.indexOf('blur/preview:mask')).toBe(ids.indexOf('blur/value:mask') + 1);
  });
});

describe('paintRun with previews', () => {
  it('fills a slot with an image naming the preview, and moves nothing', () => {
    const specs = built();
    const out = bitmap();
    const painted = paintRun(PIPELINE, specs, runWith({ out }));
    expect(byId(painted, slot('blur', 'out'))!.data).toEqual({ image: { src: bitmapSrc(out) } });
    for (const spec of specs) expect(byId(painted, spec.id as string)!.pose).toEqual(spec.pose);
  });

  it('leaves the frame on an output the run has no preview for', () => {
    const specs = built();
    const painted = paintRun(PIPELINE, specs, runWith({ out: bitmap() }));
    expect(byId(painted, slot('blur', 'mask'))!.data).toEqual(byId(specs, slot('blur', 'mask'))!.data);
  });

  it('fades the frame of a stage the run never reached', () => {
    const painted = paintRun(PIPELINE, built(), runWith({ out: bitmap() }));
    const stroke = (byId(painted, slot('tail', 'out'))!.data.stroke as { paint: { opacity?: number } }).paint;
    expect(stroke.opacity).toBeLessThan(1);
  });

  it('writes nothing to the scene when the next run hands back the same preview, and one data edit when it changes', () => {
    const scene = createScene<DiagramSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const specs = built();
    const out = bitmap();
    const first = paintRun(PIPELINE, specs, runWith({ out }));
    reconcileSpecs(scene, [], first);
    const update = vi.spyOn(scene, 'update');
    const setPose = vi.spyOn(scene, 'setPose');

    const again = paintRun(PIPELINE, specs, runWith({ out }));
    reconcileSpecs(scene, first, again);
    expect(update).not.toHaveBeenCalled();

    const next = bitmap();
    reconcileSpecs(scene, again, paintRun(PIPELINE, specs, runWith({ out: next })));
    expect(update.mock.calls.map(([id]) => id)).toEqual([slot('blur', 'out')]);
    expect(setPose).not.toHaveBeenCalled();
    expect((scene.get(slot('blur', 'out') as never)!.data as DiagramSceneData).image).toEqual({ src: bitmapSrc(next) });
  });
});
