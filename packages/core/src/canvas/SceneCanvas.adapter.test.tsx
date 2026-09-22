/**
 * The adapter `<SceneCanvas>` synthesizes for its scene: its identity across
 * renders, the container cascade under absolute poses, and the frame model
 * reaching it when `poseComposition` is set. Read through `useOptionalViewInputs`,
 * which carries the same adapter `<Canvas>` is handed.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs } from './viewInputs';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Scene } from 'core/scene/types';
import { RECT_POSE_COMPOSITION } from 'features/groups/composePose';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };
type Adapter = {
  getPose(id: string): P;
  getWorldPose(id: string): P;
  setPose(id: string, pose: P): void;
};

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.add({ id: asNodeId('box'), kind: 'container', layer: 'main', pose: { x: 100, y: 100, width: 50, height: 50 }, data: { kind: 'rect' } });
  s.add({ id: asNodeId('kid'), kind: 'leaf', layer: 'main', parent: asNodeId('box'), pose: { x: 10, y: 10, width: 5, height: 5 }, data: { kind: 'rect' } });
  s.history.clear();
  return s;
}

const seen: Adapter[] = [];
function Probe() {
  const inputs = useOptionalViewInputs();
  seen.push(inputs!.adapter as unknown as Adapter);
  return null;
}

let bump: () => void = () => {};
function Host({ scene, framed }: { scene: Scene<D, L, P>; framed?: boolean }) {
  const [, setN] = useState(0);
  bump = () => setN((n) => n + 1);
  return (
    <SceneCanvas<D, L, P>
      scene={scene}
      width={400}
      height={400}
      {...(framed ? { poseComposition: RECT_POSE_COMPOSITION } : {})}
    >
      <Probe />
    </SceneCanvas>
  );
}

describe('SceneCanvas adapter', () => {
  it('keeps its identity across re-renders with unchanged options', () => {
    seen.length = 0;
    render(<Host scene={makeScene()} />);
    const first = seen[seen.length - 1];
    const before = seen.length;
    act(() => bump());
    act(() => bump());
    expect(seen.length).toBeGreaterThan(before);
    expect(new Set(seen.slice(before)).size).toBe(1);
    expect(seen[seen.length - 1]).toBe(first);
  });

  it('moves a container’s children with it, as one undo entry', () => {
    seen.length = 0;
    const scene = makeScene();
    render(<Host scene={scene} />);
    const adapter = seen[seen.length - 1];
    act(() => adapter.setPose('box', { x: 120, y: 90, width: 50, height: 50 }));
    expect(scene.get(asNodeId('kid'))!.pose).toEqual({ x: 30, y: 0, width: 5, height: 5 });
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['move container']);
  });

  it('under a frame, reads world poses through it and leaves children where they are', () => {
    seen.length = 0;
    const scene = makeScene();
    render(<Host scene={scene} framed />);
    const adapter = seen[seen.length - 1];
    expect(adapter.getWorldPose('kid')).toEqual({ x: 110, y: 110, width: 5, height: 5 });
    act(() => adapter.setPose('box', { x: 120, y: 90, width: 50, height: 50 }));
    expect(scene.get(asNodeId('kid'))!.pose).toEqual({ x: 10, y: 10, width: 5, height: 5 });
  });
});
