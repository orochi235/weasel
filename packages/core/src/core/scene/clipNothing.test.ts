import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON } from 'core/scene/scene';
import { CLIP_NOTHING, clipNothing } from './clipNothing';
import type { RectPose } from './types';

const LAYERS = [{ id: 'main' as const }];
const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };

describe('clipNothing', () => {
  it('saves under the kit key and comes back from JSON with no consumer registry', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: LAYERS });
    const g = scene.add({ kind: 'container', layer: 'main', pose: POSE, data: {}, clipFromPose: clipNothing });
    const json = JSON.parse(JSON.stringify(scene.toJSON()));
    expect(json.nodes.find((n: { id: string }) => n.id === (g as string)).clipFromPoseKey).toBe(CLIP_NOTHING);
    const reloaded = sceneFromJSON<object, 'main', RectPose>(json, {});
    expect((reloaded.get(g) as { clipFromPose?: unknown }).clipFromPose).toBe(clipNothing);
  });
});
