/** Avoid routing installs its edit pass at `DIAGRAM_PASS_ORDER.avoid`: a pass
 *  ordered after it hears the routes it wrote, one ordered before does not. */
import { describe, expect, it } from 'vitest';
import { createScene, type RectPose, type SceneEditSummary } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { DIAGRAM_PASS_ORDER } from '../passOrder';
import { installAvoidRouting } from './install';

const box = (id: string, x: number, y: number, width = 100, height = 60) =>
  ({ id, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

describe('avoid routing’s pass order', () => {
  it('runs after the off-page pass and before the label pass', () => {
    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }],
      registry: withDiagramRegistry(),
      initial: [box('a', 0, 0), box('b', 400, 0), {
        id: 'ab', kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {}, router: 'avoid', route: [] } },
        dependsOn: ['a', 'b'], derivePath: EDGE_DERIVE_PATH,
      }] as never,
    });
    const heard: Record<string, SceneEditSummary> = {};
    scene.addEditPass((s) => { heard.labels = s; return null; }, { order: DIAGRAM_PASS_ORDER.labels });
    installAvoidRouting(scene);
    scene.addEditPass((s) => { heard.offPage = s; return null; }, { order: DIAGRAM_PASS_ORDER.offPage });
    scene.add(box('wall', 200, -100, 60, 260) as never);
    expect(heard.offPage!.dataChanged.has('ab' as never)).toBe(false);
    expect(heard.labels!.dataChanged.has('ab' as never)).toBe(true);
  });
});
