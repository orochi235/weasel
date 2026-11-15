import {
  IDENTITY_POSE_COMPOSITION,
  asNodeId,
  polygonFromPoints,
  SceneCanvas,
  useScene,
  useSelection, movePreset, pickPreset, transformPreset,
} from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type { Path } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { DemoStage } from './DemoStage';

const W = 400, H = 300;
const SNAP = { sources: [gridSnapSource({ spacing: 20 })] };
const ID = 'p';

const INITIAL_PATH: Path = polygonFromPoints([
  { x: 80, y: 200 },
  { x: 200, y: 60 },
  { x: 320, y: 200 },
  { x: 260, y: 240 },
  { x: 140, y: 240 },
]);

export function PathPoseDemo() {
  // The trivial `useScene({ items })` form makes each item its own pose, and a Path has no id.
  const scene = useScene<{ id: string }, 'default', Path>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { id: ID },
      id: asNodeId(ID),
    }],
  });
  const selection = useSelection({ scene, initial: [asNodeId(ID)] });

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={[pickPreset, movePreset, transformPreset]}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        snap={SNAP}
        layers={{
          scene: {
            drawOne: (_o, p): DrawCommand[] => [{
              kind: 'path',
              path: p,
              fill: { paint: { color: '#7fb069' } },
              stroke: { paint: { color: '#1a130d' }, width: 1.5 },
            }],
          },
        }}
      />
    </DemoStage>
  );
}
