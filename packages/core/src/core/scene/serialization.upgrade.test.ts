import { describe, expect, it } from 'vitest';
import { createScene, sceneFromJSON } from './scene';
import { specsFromSerialized } from './serialization';
import type { NodeUpgrade, RectPose, SceneRegistry, SerializedScene } from './types';

type Data = { tag?: string; label?: string };
type Json = SerializedScene<Data, 'main', RectPose>;

const box = (x: number): RectPose => ({ x, y: 0, width: 10, height: 10 });
const follow = (_n: unknown, deps: readonly ({ pose: RectPose } | undefined)[]): RectPose | null => deps[0]?.pose ?? null;

/** Renames `data.label` to `data.tag` and the derive key `old:follow` to `new:follow`. */
const rename: NodeUpgrade = (node) => {
  let out = node;
  const data = node.data as Record<string, unknown> | null;
  if (data !== null && typeof data === 'object' && 'label' in data) {
    const { label, ...rest } = data;
    out = { ...out, data: { ...rest, tag: label } };
  }
  if (out.derivePoseKey === 'old:follow') out = { ...out, derivePoseKey: 'new:follow' };
  return out;
};

const registry: SceneRegistry<RectPose, Data, 'main'> = {
  derivePose: { 'new:follow': follow as never },
  upgrades: { 'test:rename': rename },
};

const oldSave = (): Json => ({
  version: 3,
  systemLayers: [{ id: 'main' }],
  nodes: [
    { id: 'a', kind: 'mark', layer: 'main', pose: box(5), data: { label: 'x' } },
    { id: 'b', kind: 'mark', layer: 'main', pose: box(0), data: {}, dependsOn: ['a'], derivePoseKey: 'old:follow' },
  ],
});

describe('SceneRegistry.upgrades', () => {
  it('loads an old save to the scene a new save of it gives', () => {
    const scene = sceneFromJSON<Data, 'main', RectPose>(oldSave(), { registry });
    const saved = scene.toJSON();
    expect(saved.nodes.find((n) => n.id === 'a')!.data).toEqual({ tag: 'x' });
    expect(saved.nodes.find((n) => n.id === 'b')!.derivePoseKey).toBe('new:follow');
    expect(sceneFromJSON<Data, 'main', RectPose>(saved, { registry }).toJSON()).toEqual(saved);
  });

  it('leaves the save it was handed as it was', () => {
    const json = oldSave();
    specsFromSerialized(json, registry);
    expect(json).toEqual(oldSave());
  });

  it('runs on loadState too', () => {
    const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry });
    scene.loadState(oldSave());
    expect(scene.get('a' as never)!.data).toEqual({ tag: 'x' });
  });

  it('runs every upgrade, in key order', () => {
    const seen: string[] = [];
    const mark = (k: string): NodeUpgrade => (n) => (seen.push(`${k}:${n.id}`), n);
    specsFromSerialized(oldSave(), { ...registry, upgrades: { one: mark('one'), two: mark('two'), rename } });
    expect(seen).toEqual(['one:a', 'two:a', 'one:b', 'two:b']);
  });

  it('refuses a node an upgrade leaves malformed', () => {
    const breaks: NodeUpgrade = (n) => ({ ...n, layer: undefined as never });
    expect(() => specsFromSerialized(oldSave(), { upgrades: { breaks } })).toThrow('no string `layer`');
  });

  it('without the upgrade, the old key is unknown', () => {
    expect(() => sceneFromJSON<Data, 'main', RectPose>(oldSave(), { registry: { derivePose: registry.derivePose } })).toThrow("'old:follow'");
  });
});
