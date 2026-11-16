import { useMemo } from 'react';
import { asNodeId, RIGID_POSE_COMPOSITION, SceneCanvas, solid, useScene, type Fill, type GroupBoxData, type RectPose, type Stroke, type UnitScope, viewPreset } from '@weasel-js/core';
import { createGuidesLayer, createRulers, guideSnapSource, useGuides } from '@weasel-js/guides';
import { METRIC_MM } from '@weasel-js/quantity';
import { Rulers } from '@weasel-js/ui/components/Rulers';
import { DemoStage } from './DemoStage';
import { movePreset, selectPreset } from '@weasel-js/editing';

interface Data extends GroupBoxData { fill?: Fill; stroke?: Stroke }

const W = 520, H = 340;
/** The document is measured in points, 72 to the inch. */
const ROOT: UnitScope = { system: { base: 'pt', units: { pt: 1, in: 72 } } };
/** A millimeter part, drawn at half size. */
const PART: UnitScope = { system: METRIC_MM, scale: 72 / 25.4, drawnAt: 0.5 };

const START = { x: -40, y: -40, scale: { x: 1, y: 1 } };

const box = (x: number, y: number, width: number, height: number): RectPose => ({ x, y, width, height, rotation: 0 });
const PART_ID = asNodeId('part');
const NODES = [
  { id: PART_ID, kind: 'group' as const, layer: 'default' as const, parent: null, units: PART, pose: { ...box(260, 90, 200, 160), transform: [0.5, 0, 0, 0.5] as const }, data: { border: { paint: solid('#8aa0c0'), width: 2 } } },
  { id: asNodeId('bolt'), kind: 'mark' as const, layer: 'default' as const, parent: PART_ID, pose: box(60, 60, 80, 40), data: { fill: { paint: solid('#7fb069') } } },
  { id: asNodeId('plate'), kind: 'mark' as const, layer: 'default' as const, parent: null, pose: box(70, 110, 120, 80), data: { fill: { paint: solid('#e0a458') } } },
];

export function RulersDemo() {
  const scene = useScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }], initial: NODES, composition: RIGID_POSE_COMPOSITION,
  });
  const guides = useGuides();
  const { addGuide, removeGuide, getGuides, subscribe } = guides;
  const rulers = useMemo(() => createRulers({ guides: { addGuide, removeGuide, getGuides }, root: ROOT }), [addGuide, removeGuide, getGuides]);
  const ambient = useMemo(() => [rulers.contribution], [rulers]);
  const guidesLayer = useMemo(
    () => createGuidesLayer({ getGuides: () => rulers.settled(getGuides()), subscribe, extent: 'full' }),
    [rulers, getGuides, subscribe],
  );
  const snap = useMemo(() => ({ sources: [guideSnapSource({ getGuides })] }), [getGuides]);

  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={[selectPreset, movePreset, viewPreset]}
        className="ckd-canvas"
        scene={scene}
        ambient={ambient}
        snap={snap}
        defaultView={START}
        layers={{ guides: { layer: guidesLayer, after: 'scene' } }}
      />
      <Rulers rulers={rulers} />
    </DemoStage>
  );
}
