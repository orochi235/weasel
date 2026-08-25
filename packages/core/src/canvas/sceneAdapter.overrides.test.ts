import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { sceneToAdapter } from './sceneAdapter';

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
