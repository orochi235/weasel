/** `scene` takes a live `Scene` or its JSON snapshot; a snapshot is baked once. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';

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
});
