import { describe, expect, it } from 'vitest';
import type { Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/geometry/rectPose';
import type { ExportScene } from './exportTypes';

// Enforced by `npm run typecheck`; the runtime body keeps vitest from reporting an empty file.

type Data = { path: Path; stroke: Stroke };

describe('ExportScene', () => {
  it('takes a concretely typed rect-posed scene without a cast', () => {
    const scene = createScene<Data, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });
    const exported: ExportScene = scene;
    expect(exported.nodes.size).toBe(0);
  });
});
