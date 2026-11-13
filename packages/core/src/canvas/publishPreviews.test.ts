import { describe, expect, it } from 'vitest';
import type { OngoingHandle } from '@weasel-js/routing';
import { publishPreviews } from './publishPreviews';
import { nodeAsShown } from 'core/scene/nodeAsShown';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';

describe('publishPreviews', () => {
  it('drops a field the preview removes from a node written mid-gesture, whatever the field is named', () => {
    const scene = createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({
      kind: 'mark', layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 },
      data: { valueOf: 1, keep: 2 },
    });
    const handle = { previewIds: () => [id], previewData: () => ({ keep: 3 }) } as unknown as OngoingHandle;
    const stop = publishPreviews(scene, { inFlight: () => new Map([['g', handle]]), subscribe: () => () => {} });
    scene.update(id, { data: { valueOf: 1, keep: 2, other: 4 } });
    expect(nodeAsShown(scene.overrides, scene.get(id)!).data).toStrictEqual({ keep: 3, other: 4 });
    stop();
  });
});
