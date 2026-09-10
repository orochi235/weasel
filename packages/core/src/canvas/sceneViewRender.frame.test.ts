/**
 * End to end through the walk *and* the per-node wrap.
 *
 * The pose tests upstream prove the walk hands the painter a world pose. They
 * cannot see the other half: `wrapNodeOutput` turns the painter's output about
 * that pose's center, so a composed pose that is right in the walk and wrong in
 * the wrap produces correct numbers and a visibly wrong picture. This reads the
 * geometry the renderer would actually draw.
 *
 * A framebuffer check would be better still and needs a browser; this is the
 * closest a unit test gets, and it is a proxy — see `tests/visual/` for the
 * real thing.
 */
import { describe, expect, it } from 'vitest';
import { buildSceneViewCommands } from './sceneViewRender';
import { mat3 } from '../renderer/math/mat3';
import {
  FRAME_FIXTURE_IDS,
  FRAME_FIXTURE_WORLD,
  makeFrameFixture,
  type FrameFixtureData,
  type FrameFixtureLayer,
} from 'features/groups/frameFixture';
import { RIGID_POSE_COMPOSITION } from 'features/groups/composePose';
import type { RectPose } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import type { View } from 'core/viewport/view';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Walk the emitted tree carrying the accumulated transform, and return the
 *  world-space corners of the rect the painter tagged with `wanted`. */
function drawnCorners(cmds: readonly DrawCommand[], wanted: string): [number, number][] {
  const out: [number, number][] = [];
  const walk = (list: readonly DrawCommand[], m: number[] | null): void => {
    for (const cmd of list) {
      if (cmd.kind === 'group') {
        const own = cmd.transform as unknown as number[] | undefined;
        walk(cmd.children, own ? (m ? (mat3.multiply(m as never, own as never) as unknown as number[]) : own) : m);
      } else if (cmd.kind === 'path' && cmd.path.kind === 'rect' && (cmd.fill as { color?: string } | undefined)?.color === wanted) {
        const { x, y, width, height } = cmd.path;
        for (const [px, py] of [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]) {
          out.push(m ? (mat3.apply(m as never, px, py) as [number, number]) : [px, py]);
        }
      }
    }
  };
  walk(cmds, null);
  return out;
}

/** Painter that draws each node's pose box, tagged with the node's id. */
const drawPoseBox = (node: { id: string }, pose: RectPose): DrawCommand[] => [
  {
    kind: 'path',
    path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
    fill: { color: node.id },
  },
];

function cornersFor(compose: boolean, id: string): [number, number][] {
  const scene = makeFrameFixture();
  const cmds = buildSceneViewCommands<FrameFixtureData, FrameFixtureLayer, RectPose>(
    scene,
    VIEW,
    drawPoseBox as never,
    undefined,
    undefined,
    compose ? RIGID_POSE_COMPOSITION : undefined,
  );
  return drawnCorners(cmds, id);
}

describe('what the renderer would draw for a framed child', () => {
  it('puts the upright child at its composed position and orientation', () => {
    const pts = cornersFor(true, FRAME_FIXTURE_IDS.upright);
    expect(pts).toHaveLength(4);
    const cx = pts.reduce((a, p) => a + p[0], 0) / 4;
    const cy = pts.reduce((a, p) => a + p[1], 0) / 4;
    const w = FRAME_FIXTURE_WORLD.a;
    expect(cx).toBeCloseTo(w.x + w.width / 2, 6);
    expect(cy).toBeCloseTo(w.y + w.height / 2, 6);

    // The child is 20x10 turned a quarter turn, so the drawn quad is 10 across
    // and 20 tall. A wrap that never fired would leave it 20 across.
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(20, 6);
  });

  it('draws it at its stored pose with no strategy', () => {
    const pts = cornersFor(false, FRAME_FIXTURE_IDS.upright);
    const cx = pts.reduce((a, p) => a + p[0], 0) / 4;
    expect(cx).toBeCloseTo(20, 6);
  });
});
