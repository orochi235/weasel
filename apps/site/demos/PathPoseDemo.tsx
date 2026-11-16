import { IDENTITY_POSE_COMPOSITION, asNodeId, polygonFromPoints, SceneCanvas, solid, useScene } from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type { Fill, Path, Stroke } from '@weasel-js/core';
import { DemoStage } from './DemoStage';
import { movePreset, pickPreset, transformPreset, useSelection } from '@weasel-js/editing';

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
  const scene = useScene<{ fill: Fill; stroke: Stroke }, 'default', Path>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { fill: { paint: solid('#7fb069') }, stroke: { paint: solid('#1a130d'), width: 1.5 } },
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
      />
    </DemoStage>
  );
}
