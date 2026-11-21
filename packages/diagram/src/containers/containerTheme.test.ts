import { describe, expect, it } from 'vitest';
import { commitOps, createScene, type ActionDeps, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '../edge';
import { applyDiagramTheme } from '../theme/applyTheme';
import { DIAGRAM_THEMES } from '../theme/themes';
import { CONTAINER_STENCILS, addLane, containerBuild, lanesOf } from './containerStencils';

const POOL = CONTAINER_STENCILS.find((s) => s.id === 'pool-rows')!;
const AT: RectPose = { x: 0, y: 0, width: 480, height: 240 };

function makeScene() {
  return createScene<Record<string, unknown>, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
}

const fillOf = (scene: ReturnType<typeof makeScene>, id: string) =>
  (scene.get(id as never)!.data as { fill?: { paint: { color: string } } }).fill?.paint.color;

describe('containers in a theme', () => {
  it('builds a pool in the lane colors it is given: the header, then each lane body in turn', () => {
    const scene = makeScene();
    const { lane } = DIAGRAM_THEMES.paper!;
    let n = 0;
    const built = containerBuild(POOL, AT, { layer: 'main', newId: () => `p${n++}`, laneStyles: lane });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    expect(fillOf(scene, built.id)).toBe(lane.header.fill);
    const lanes = lanesOf(scene as never, built.id);
    expect(lanes).toHaveLength(2);
    // A lane draws no fill of its own; its stroke takes the body color.
    expect(lanes.map((id) => (scene.get(id)!.data as { stroke: { paint: { color: string } } }).stroke.paint.color))
      .toEqual([lane.bodies[0]!.stroke, lane.bodies[1 % lane.bodies.length]!.stroke]);
  });

  it('colors a lane added to a pool in a themed scene as a theme change would, in the same undo entry', () => {
    const scene = makeScene();
    let n = 0;
    const built = containerBuild(POOL, AT, { layer: 'main', newId: () => `p${n++}` });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    applyDiagramTheme(scene as never, DIAGRAM_THEMES.blueprint!);
    const entries = scene.historyIndex();
    const added = addLane(scene as never, built.id)!;
    expect(scene.historyIndex()).toBe(entries + 1);
    const before = JSON.stringify(scene.get(added as never)!.data);
    applyDiagramTheme(scene as never, DIAGRAM_THEMES.blueprint!);
    expect(JSON.stringify(scene.get(added as never)!.data)).toBe(before);
  });

  it('colors a lane added at the start of the stack by its place there, and restripes the lanes after it', () => {
    const scene = makeScene();
    let n = 0;
    const built = containerBuild(POOL, AT, { layer: 'main', newId: () => `p${n++}` });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    const theme = DIAGRAM_THEMES.paper!;
    applyDiagramTheme(scene as never, theme);
    addLane(scene as never, built.id, 0);
    const fills = lanesOf(scene as never, built.id).map((id) => fillOf(scene, id));
    const bodies = theme.lane.bodies;
    expect(fills).toEqual(fills.map((_, i) => bodies[i % bodies.length]!.fill));
  });

  it('restripes the lanes after one added with a style of its own', () => {
    const scene = makeScene();
    let n = 0;
    const built = containerBuild(POOL, AT, { layer: 'main', newId: () => `p${n++}` });
    commitOps({ scene } as unknown as ActionDeps, built.ops, 'Insert');
    const theme = DIAGRAM_THEMES.paper!;
    applyDiagramTheme(scene as never, theme);
    const added = addLane(scene as never, built.id, 0, { fill: '#ff0000', stroke: '#00ff00', text: '#0000ff' })!;
    const later = lanesOf(scene as never, built.id).filter((id) => id !== added);
    const bodies = theme.lane.bodies;
    expect(later.map((id) => fillOf(scene, id))).toEqual(later.map((_, i) => bodies[(i + 1) % bodies.length]!.fill));
    expect((scene.get(added as never)!.data as { stroke: { paint: { color: string } } }).stroke.paint.color).toBe('#00ff00');
  });
});
