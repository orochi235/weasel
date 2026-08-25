import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';
import { buildSceneTree } from './buildSceneTree';
import type { GroupDrawCommand } from '../renderer';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };

function setup() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'a' } });
  const adapter = sceneToAdapter(scene);
  return { scene, id, adapter };
}

describe('sceneToAdapter.getPose — override read-through', () => {
  it('returns the document pose when there is no override', () => {
    const { adapter, id } = setup();
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('returns the override pose when there is one', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 40, y: 40, width: 10, height: 10 } });
    expect(adapter.getPose(id)).toEqual({ x: 40, y: 40, width: 10, height: 10 });
  });

  it('falls back to the document pose for an alpha-only override', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { alpha: 0.5 });
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('returns the document pose again once the override is cleared', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 40, y: 40, width: 10, height: 10 } });
    scene.overrides.clear(id);
    expect(adapter.getPose(id)).toEqual(POSE);
  });

  it('still throws for an unknown id', () => {
    const { adapter } = setup();
    expect(() => adapter.getPose('nope')).toThrow(/unknown node/);
  });
});

describe('overrides on the walk', () => {
  it('hands the override pose to drawOne', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 33, y: 44, width: 10, height: 10 } });

    const seen: { x: number; y: number }[] = [];
    buildSceneTree(
      adapter as Parameters<typeof buildSceneTree>[0],
      ((_node: unknown, pose: { x: number; y: number }) => { seen.push(pose); return []; }) as Parameters<typeof buildSceneTree>[1],
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
    );

    expect(seen).toEqual([{ x: 33, y: 44, width: 10, height: 10 }]);
  });

  it('moves a container\'s clip with its override', () => {
    const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
    const parent = scene.add({
      kind: 'container',
      layer: 'main',
      pose: { x: 0, y: 0, width: 50, height: 50 },
      data: { label: 'p' },
      clipFromPose: (p: typeof POSE) => ({ kind: 'rect' as const, x: p.x, y: p.y, width: p.width, height: p.height }),
    });
    scene.add({ kind: 'leaf', layer: 'main', pose: POSE, data: { label: 'c' }, parent });
    const adapter = sceneToAdapter(scene);

    scene.overrides.set(parent, { pose: { x: 200, y: 0, width: 50, height: 50 } });

    const tree = buildSceneTree(
      adapter as Parameters<typeof buildSceneTree>[0],
      (() => []) as Parameters<typeof buildSceneTree>[1],
      { x: 0, y: 0, scale: { x: 1, y: 1 } },
    );

    const clips: { x: number }[] = [];
    const walk = (cmd: unknown): void => {
      const g = cmd as GroupDrawCommand;
      if (g.kind !== 'group') return;
      if (g.clip) clips.push(g.clip as unknown as { x: number });
      for (const child of g.children ?? []) walk(child);
    };
    for (const cmd of tree) walk(cmd);

    expect(clips.length).toBeGreaterThan(0);
    expect(clips.every((c) => c.x === 200)).toBe(true);
  });
});

describe('overrides and picking', () => {
  it('picks the node where the override draws it, not where the document says', () => {
    const { scene, adapter, id } = setup();
    scene.overrides.set(id, { pose: { x: 100, y: 100, width: 10, height: 10 } });

    // The same read the default `pickEvery` performs (useSelectTool.ts:199).
    const pose = adapter.getPose(id) as typeof POSE;
    const covers = (wx: number, wy: number) =>
      wx >= pose.x && wx <= pose.x + pose.width && wy >= pose.y && wy <= pose.y + pose.height;

    expect(covers(105, 105)).toBe(true);
    expect(covers(5, 5)).toBe(false);
  });
});
