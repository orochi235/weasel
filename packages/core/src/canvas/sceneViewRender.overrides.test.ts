import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { buildSceneViewCommands } from './sceneViewRender';
import { defaultDrawOne } from './defaultDrawOne';
import { scenePickSource } from './scenePickSource';
import type { DrawCommand } from '@weasel-js/renderer';

type Layer = 'main';
interface Data { label: string }
const POSE = { x: 0, y: 0, width: 10, height: 10 };
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup() {
  const scene = createScene<Data, Layer>({ systemLayers: [{ id: 'main' }] });
  const id = scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { label: 'a' } });
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

  it('recomputes a memoized painter after an in-place mutation is committed', () => {
    const scene = createScene<{ text: string; style: { fontFamily: string; fontSize: number } }, Layer>({
      systemLayers: [{ id: 'main' }],
    });
    const id = scene.add({
      kind: 'mark', layer: 'main', pose: POSE,
      data: { text: 'Hello', style: { fontFamily: 'sans-serif', fontSize: 20 } },
    });
    const textX = (): number | undefined => {
      let x: number | undefined;
      const find = (cmd: DrawCommand): void => {
        const c = cmd as { kind: string; x?: number; children?: DrawCommand[] };
        if (c.kind === 'text') x = c.x;
        for (const child of c.children ?? []) find(child);
      };
      for (const cmd of buildSceneViewCommands(scene, VIEW, defaultDrawOne)) find(cmd);
      return x;
    };
    const buffer = { x: 0, y: 0, width: 10, height: 10 };
    scene.overrides.set(id, { pose: buffer });

    expect(textX()).toBe(0);

    buffer.x = 120;
    scene.overrides.commit();

    expect(textX()).toBe(120);
  });

  describe('a data override', () => {
    /** Every label `drawOne` was handed, in walk order. */
    const labelsSeen = (scene: ReturnType<typeof setup>['scene']): string[] => {
      const seen: string[] = [];
      buildSceneViewCommands(scene, VIEW, (node) => {
        seen.push((node.data as Data).label);
        return [];
      });
      return seen;
    };

    it('paints the data it shows, leaving the stored data alone', () => {
      const { scene, id } = setup();
      scene.overrides.set(id, { data: (d) => ({ ...d, label: `${d.label}!` }) });
      expect(labelsSeen(scene)).toEqual(['a!']);
      expect(scene.get(id)!.data.label).toBe('a');
    });

    it('shows a recorded write made while it is installed', () => {
      const { scene, id } = setup();
      scene.overrides.set(id, { data: (d) => ({ ...d, label: `${d.label}!` }) });
      scene.update(id, { data: { label: 'b' } });
      expect(labelsSeen(scene)).toEqual(['b!']);
    });

    it('hands picking the node as it shows', () => {
      const { scene, id } = setup();
      scene.overrides.set(id, { data: () => ({ label: 'shown' }) });
      expect(scenePickSource(scene).order().map((n) => (n as { data?: Data }).data?.label)).toEqual(['shown']);
    });
  });
});
