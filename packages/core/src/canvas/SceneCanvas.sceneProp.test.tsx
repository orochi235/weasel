/** `scene` takes a live `Scene` or its JSON snapshot; a snapshot is baked once. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import type { PoseComposition } from 'core/scene/composePose';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

function sceneAt(x: number): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.add({ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: { x, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
  return s;
}

function Probe({ seen }: { seen: { x?: number } }) {
  const adapter = useOptionalViewInputs()!.adapter as { getPose(id: string): P };
  seen.x = adapter.getPose('a').x;
  return null;
}

describe('<SceneCanvas scene>', () => {
  it('bakes a snapshot into a scene of its own, and keeps it when the prop changes', () => {
    const seen: { x?: number } = {};
    const ui = (x: number) => (
      <SceneCanvas<D, L, P> scene={sceneAt(x).toJSON()} width={100} height={100}>
        <Probe seen={seen} />
      </SceneCanvas>
    );
    const { rerender } = render(ui(5));
    expect(seen.x).toBe(5);
    rerender(ui(9));
    expect(seen.x).toBe(5);
  });

  it('follows a live scene prop', () => {
    const seen: { x?: number } = {};
    const ui = (scene: Scene<D, L, P>) => (
      <SceneCanvas<D, L, P> scene={scene} width={100} height={100}>
        <Probe seen={seen} />
      </SceneCanvas>
    );
    const { rerender } = render(ui(sceneAt(5)));
    expect(seen.x).toBe(5);
    rerender(ui(sceneAt(9)));
    expect(seen.x).toBe(9);
  });

  it('bakes a snapshot that nests poses it cannot read as rects under the composition it is given', () => {
    const json = solidScene().toJSON();
    const seen: { world?: Solid } = {};
    render(
      <SceneCanvas<object, L, Solid> scene={json} composition={SHIFT} width={100} height={100}>
        <WorldProbe id="c" seen={seen} />
      </SceneCanvas>,
    );
    expect(seen.world).toEqual({ position: { x: 12, y: 3, z: -4 }, size: 1 });
  });

  it('refuses that snapshot without one, naming the prop', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<SceneCanvas<object, L, Solid> scene={solidScene().toJSON()} width={100} height={100} />))
      .toThrow(/node "c".*not a rect.*<SceneCanvas composition>/s);
  });
});

/** A pose with no `x`/`width`, as kernel3d's `Pose3` has none, folded by adding positions. */
type Solid = { position: { x: number; y: number; z: number }; size: number };
const at = (x: number, y: number, z: number): Solid => ({ position: { x, y, z }, size: 1 });
const SHIFT: PoseComposition<Solid> = {
  compose: (p, c) => at(p.position.x + c.position.x, p.position.y + c.position.y, p.position.z + c.position.z),
  decompose: (p, w) => at(w.position.x - p.position.x, w.position.y - p.position.y, w.position.z - p.position.z),
  closure: 'rigid',
};

function solidScene(): Scene<object, L, Solid> {
  return createScene<object, L, Solid>({
    composition: SHIFT,
    systemLayers: [{ id: 'main' }],
    initial: [
      { id: asNodeId('g'), kind: 'group', layer: 'main', pose: at(10, 1, -5), data: {} },
      { id: asNodeId('c'), kind: 'mark', layer: 'main', parent: asNodeId('g'), pose: at(2, 2, 1), data: {} },
    ],
  });
}

function WorldProbe({ id, seen }: { id: string; seen: { world?: Solid } }) {
  const adapter = useOptionalViewInputs()!.adapter as { getWorldPose(id: string): Solid };
  seen.world = adapter.getWorldPose(id);
  return null;
}
