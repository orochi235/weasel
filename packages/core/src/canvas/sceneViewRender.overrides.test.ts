import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { buildSceneViewCommands } from './sceneViewRender';
import type { DrawCommand } from '../renderer';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  return { scene, id };
}

/** Every pose `drawOne` was called with, in walk order. */
function posesSeen(scene: ReturnType<typeof setup>['scene']): { x: number; y: number }[] {
  const seen: { x: number; y: number }[] = [];
  buildSceneViewCommands(scene, VIEW, (_node, pose) => {
    seen.push(pose as { x: number; y: number });
    return [];
  });
  return seen;
}

describe('buildSceneViewCommands — overrides', () => {
  it('paints the document pose with no override', () => {
    const { scene } = setup();
    expect(posesSeen(scene)).toEqual([POSE]);
  });

  it('paints the override pose when there is one', () => {
    const { scene, id } = setup();
    scene.overrides.set(id, { pose: { x: 60, y: 70, width: 10, height: 10 } });
    expect(posesSeen(scene)).toEqual([{ x: 60, y: 70, width: 10, height: 10 }]);
  });

  it('multiplies the override alpha into alphaFor rather than replacing it', () => {
    const { scene, id } = setup();
    scene.overrides.set(id, { alpha: 0.5 });

    const alphas: number[] = [];
    const collect = (cmd: DrawCommand): void => {
      const g = cmd as { kind: string; alpha?: number; children?: DrawCommand[] };
      if (typeof g.alpha === 'number') alphas.push(g.alpha);
      for (const child of g.children ?? []) collect(child);
    };
    const cmds = buildSceneViewCommands(
      scene,
      VIEW,
      () => [{ kind: 'rect', x: 0, y: 0, width: 1, height: 1, fill: { color: '#000' } } as unknown as DrawCommand],
      undefined,
      () => 0.4,
    );
    for (const cmd of cmds) collect(cmd);

    expect(alphas).toContain(0.2);
  });

  it('recomputes a painter after an in-place mutation is committed', () => {
    const { scene, id } = setup();
    const buffer = { x: 0, y: 0, width: 10, height: 10 };
    scene.overrides.set(id, { pose: buffer });

    expect(posesSeen(scene)[0]).toEqual({ x: 0, y: 0, width: 10, height: 10 });

    buffer.x = 120;                 // same object, mutated in place
    scene.overrides.commit();

    expect(posesSeen(scene)[0]).toEqual({ x: 120, y: 0, width: 10, height: 10 });
  });
});
