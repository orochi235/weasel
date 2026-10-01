/**
 * The paint walk against how many of its nodes carry a pose override.
 *
 * One iteration is one animated frame as a frame loop drives it: move every
 * overridden node's entry in place, `commit()`, then build the frame's draw
 * commands. The walk reads every node's override — its pose through
 * `effectivePose` and its alpha in the node wrapper — so the 0% row is what
 * the table costs a scene nothing is animating, and the 100% row is a
 * select-all drag.
 *
 * The override-read group isolates the table from the rest of the walk:
 * `effectivePose` on every node after a commit, nothing drawn.
 */
import { group } from './group';
import { buildSceneViewCommands } from 'canvas/sceneViewRender';
import { effectivePose } from 'core/scene/effectivePose';
import type { DrawCommand } from 'renderer/DrawCommand';
import type { NodeId, PoseOverride } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import { scatterScene, type BenchScene } from './fixtures';

type RectPose = { x: number; y: number; width: number; height: number };

const NODE_COUNTS = [1000, 10000];
const SHARES = [
  { label: '0% overridden', f: 0 },
  { label: '10% overridden', f: 0.1 },
  { label: '100% overridden', f: 1 },
];

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

const drawOne = (_node: unknown, pose: unknown): DrawCommand[] => {
  const p = pose as RectPose;
  return [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { fill: 'solid', color: '#888' },
  }];
};

interface Animated {
  scene: BenchScene;
  entries: PoseOverride<RectPose>[];
}

/** A scene of `n` rects with the first `f` share of them overridden, each by
 *  an entry hoisted once and mutated in place, as a frame loop does. */
function animated(n: number, f: number): Animated {
  const scene = scatterScene(n, { shape: 'rect' });
  const overrides = scene.overrides as unknown as { set(id: NodeId, e: PoseOverride<RectPose>): void };
  const entries: PoseOverride<RectPose>[] = [];
  const ids = [...scene.renderOrder()];
  const k = Math.round(n * f);
  for (let i = 0; i < k; i++) {
    const id = ids[i] as NodeId;
    const pose = { ...(scene.get(id)!.pose as RectPose) };
    const entry: PoseOverride<RectPose> = { pose, alpha: 0.5 };
    overrides.set(id, entry);
    entries.push(entry);
  }
  scene.overrides.commit();
  return { scene, entries };
}

function step({ scene, entries }: Animated): void {
  for (const e of entries) (e.pose as RectPose).x += 1;
  scene.overrides.commit();
}

for (const n of NODE_COUNTS) {
  group(`paint walk with overrides — ${n} nodes`, (bench) => {
    for (const { label, f } of SHARES) {
      const a = animated(n, f);
      const walk = a.scene as unknown as Parameters<typeof buildSceneViewCommands>[0];
      bench(label, () => {
        step(a);
        buildSceneViewCommands(walk, VIEW, drawOne as never);
      });
    }
  });

  group(`override reads after a commit — ${n} nodes`, (bench) => {
    for (const { label, f } of SHARES) {
      const a = animated(n, f);
      const source = a.scene as unknown as Parameters<typeof effectivePose>[0];
      const nodes = [...a.scene.renderOrder()].map((id) => a.scene.get(id)!);
      bench(label, () => {
        step(a);
        for (const node of nodes) effectivePose(source, node as never);
      });
    }
  });
}
