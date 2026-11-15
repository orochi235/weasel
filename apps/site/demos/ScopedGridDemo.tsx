import { useMemo } from 'react';
import { asNodeId, RIGID_POSE_COMPOSITION, SceneCanvas, solid, useScene, type Fill, type GroupBoxData, type RectPose, type Stroke, type UnitScope, movePreset, selectPreset, viewPreset } from '@weasel-js/core';
import { createGridLayer, gridSnapSource, sceneGridRegions, type GridScopes } from '@weasel-js/guides';
import { DemoStage } from './DemoStage';

interface Data extends GroupBoxData { fill?: Fill; stroke?: Stroke }

const W = 480, H = 320;
const ROOT: UnitScope = { system: { base: 'px', units: { px: 1 } } };
/** A millimeter is 4 px here. */
const MM: UnitScope = { system: { base: 'mm', units: { mm: 1 } }, scale: 4 };
/** 20 px outside, 2 mm inside a millimeter scope. */
const SCOPES: GridScopes = { root: ROOT, spacing: (scope) => (scope.system.base === 'mm' ? 2 : 20) };

const box = (x: number, y: number, width: number, height: number, rotation = 0): RectPose => ({ x, y, width, height, rotation });
/** The sub-assembly is turned 20°; its children are placed in its frame. */
const ASSEMBLY = asNodeId('assembly');
const NODES = [
  { id: ASSEMBLY, kind: 'group' as const, layer: 'default' as const, parent: null, units: MM, pose: box(210, 70, 200, 180, Math.PI / 9), data: { border: { paint: solid('#8aa0c0'), width: 1 } } },
  { id: asNodeId('inside'), kind: 'mark' as const, layer: 'default' as const, parent: ASSEMBLY, pose: box(40, 40, 48, 32), data: { fill: { paint: solid('#7fb069') } } },
  { id: asNodeId('outside'), kind: 'mark' as const, layer: 'default' as const, parent: null, pose: box(60, 120, 60, 40), data: { fill: { paint: solid('#e0a458') } } },
];

export function ScopedGridDemo() {
  const scene = useScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }], initial: NODES, composition: RIGID_POSE_COMPOSITION,
  });
  const grid = useMemo(() => createGridLayer({
    spacing: 20,
    scopes: SCOPES,
    accentEvery: 5,
    regions: () => sceneGridRegions(scene, { root: ROOT }),
  }), [scene]);
  const snap = useMemo(() => ({ sources: [gridSnapSource({ spacing: 20, scopes: SCOPES })] }), []);

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={[selectPreset, movePreset, viewPreset]}
        className="ckd-canvas"
        scene={scene}
        snap={snap}
        layers={{ grid: { layer: grid } }}
      />
    </DemoStage>
  );
}
