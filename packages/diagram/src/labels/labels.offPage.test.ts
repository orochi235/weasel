import { describe, expect, it } from 'vitest';
import { PAGES_DOC_KEY, createScene, documentPose, type RectPose, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, withDiagramRegistry } from '../edge';
import { edgeLabelSpec } from '../edgeLabel';
import { diagramLabelOf, type DiagramLabel } from '../labelTrait';
import { installOffPageMarkers } from '../offPage/install';
import { installLabelPlacement } from './install';

type PagedScene = Scene<unknown, 'main', RectPose>;

const LOOK = { style: { fontFamily: 'sans-serif', fontSize: 10 }, fill: '#111111', background: '#ffffff' };

// Two 200 by 100 pages, 40 apart: p1 spans x 0..200, p2 x 240..440.
const PAGES = { pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }] };

const box = (id: string, x: number, y: number, width = 40, height = 30) =>
  ({ id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x, y, width, height }, data: { diagram: {} } });

const connector = (id: string, from: string, to: string, ports: { from: string; to: string }) => ({
  id: id as never, kind: 'leaf' as const, layer: 'main' as const, pose: { x: 0, y: 0, width: 0, height: 0 },
  data: { diagram: { from: { port: ports.from }, to: { port: ports.to } } },
  dependsOn: [from as never, to as never],
  derivePath: EDGE_DERIVE_PATH,
});

/** `a` at (20, 20) joined east to west to `b`, each with a label; `c` above `d` at the right of page 1, joined by
 *  a vertical connector whose label sits across y = 35, past `ab`'s off-page tag, on the line from `ab`'s first
 *  stub to its second that a split connector does not draw. */
function load(abLabel: DiagramLabel = { at: 'mid', offset: 9 }) {
  const scene: PagedScene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    registry: withDiagramRegistry(),
    doc: { [PAGES_DOC_KEY]: PAGES },
    initial: [
      box('a', 20, 20), box('b', 120, 20), box('c', 160, 0, 40, 10), box('d', 160, 80, 40, 20), box('cover', 1000, 1000, 30, 20),
      connector('ab', 'a', 'b', { from: 'e', to: 'w' }), connector('cd', 'c', 'd', { from: 's', to: 'n' }),
      edgeLabelSpec('ab', 'note', { layer: 'main', label: abLabel }),
      edgeLabelSpec('cd', 'note', { layer: 'main', label: { at: 0.3, offset: 0 } }),
    ] as never,
  });
  installOffPageMarkers(scene, { look: () => LOOK });
  installLabelPlacement(scene);
  const move = (id: string, x: number, y?: number) => {
    const pose = scene.get(id as never)!.pose;
    scene.setPose(id as never, { ...pose, x, y: y ?? pose.y });
  };
  return { scene, move };
}

const placedOf = (scene: PagedScene, id: string) => diagramLabelOf(scene.get(id as never)!)!.placed;
const boxOf = (scene: PagedScene, id: string) => documentPose(scene, scene.get(id as never)!);

describe('label placement on a connector split across pages', () => {
  it('stands a split connector’s label on its first stub', () => {
    const { scene, move } = load();
    move('b', 300);
    const label = boxOf(scene, 'ab/label');
    // The first stub runs from a's east port (60, 35) to (84, 35).
    expect(label.x + label.width / 2).toBeCloseTo(72, 6);
    expect(label.y + label.height).toBeCloseTo(26, 6);
  });

  it('leaves another label alone where the split connector no longer runs', () => {
    const { scene, move } = load();
    move('b', 300);
    expect(placedOf(scene, 'cd/label')).toBeUndefined();
  });

  it('dodges on the first stub', () => {
    const { scene, move } = load();
    move('b', 300);
    move('cover', 58, 0);
    expect(placedOf(scene, 'ab/label')).toEqual({ at: 0.5, offset: -9 });
    const label = boxOf(scene, 'ab/label');
    expect(label.y).toBeCloseTo(44, 6);
    expect(label.x + label.width).toBeLessThan(200);
  });
});
