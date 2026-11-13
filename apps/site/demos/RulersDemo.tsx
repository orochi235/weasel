import { useMemo } from 'react';
import { asNodeId, RIGID_POSE_COMPOSITION, SceneCanvas, useScene, type RectPose, type UnitScope } from '@weasel-js/core';
import { createGuidesLayer, createRulers, guideSnapSource, useGuides } from '@weasel-js/guides';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { METRIC_MM } from '@weasel-js/quantity';
import { Rulers } from '@weasel-js/ui/components/Rulers';
import { DemoStage } from './DemoStage';

interface Data { color: string | null }

const W = 520, H = 340;
/** The document is measured in points, 72 to the inch. */
const ROOT: UnitScope = { system: { base: 'pt', units: { pt: 1, in: 72 } } };
/** A millimeter part, drawn at half size. */
const PART: UnitScope = { system: METRIC_MM, scale: 72 / 25.4, drawnAt: 0.5 };

const START = { x: -40, y: -40, scale: { x: 1, y: 1 } };

const box = (x: number, y: number, width: number, height: number): RectPose => ({ x, y, width, height, rotation: 0 });
const NODES = [
  { id: asNodeId('part'), kind: 'group' as const, layer: 'default' as const, parent: null, units: PART, pose: { ...box(260, 90, 200, 160), transform: [0.5, 0, 0, 0.5] as const }, data: { color: null } },
  { id: asNodeId('bolt'), kind: 'mark' as const, layer: 'default' as const, parent: asNodeId('part'), pose: box(60, 60, 80, 40), data: { color: '#7fb069' } },
  { id: asNodeId('plate'), kind: 'mark' as const, layer: 'default' as const, parent: null, pose: box(70, 110, 120, 80), data: { color: '#e0a458' } },
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
        features={['select', 'move', 'view']}
        className="ckd-canvas"
        scene={scene}
        ambient={ambient}
        snap={snap}
        defaultView={START}
        layers={{
          guides: { layer: guidesLayer, after: 'scene' },
          scene: {
            drawOne: (node, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              ...(node.data.color
                ? { fill: { paint: { color: node.data.color } } }
                : { stroke: { paint: { color: '#8aa0c0' }, width: 2 } }),
            }],
          },
        }}
      />
      <Rulers rulers={rulers} />
    </DemoStage>
  );
}
