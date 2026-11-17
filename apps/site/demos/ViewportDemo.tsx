import { useMemo, useState } from 'react';
import { solid } from '@weasel-js/paint';
import { SceneCanvas, asNodeId, useScene, viewPreset } from '@weasel-js/core';
import type { RectPose } from '@weasel-js/core';
import { createTextPreset, type TextNodeData } from '@weasel-js/text-tools';
import { useColorHex } from '@weasel-js/theme/react';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Field } from '@weasel-js/ui/components/Field';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { DemoStage } from './DemoStage';

type Layer = 'scene';

const NODES: Array<{ id: string; pose: RectPose; data: { color: string; label: string } }> = [
  { id: 'a', pose: { x:  40, y:  40, width: 100, height: 70 }, data: { color: '#7fb069', label: 'A' } },
  { id: 'b', pose: { x: 220, y:  80, width: 100, height: 70 }, data: { color: '#a48bd4', label: 'B' } },
  { id: 'c', pose: { x: 420, y:  30, width: 100, height: 70 }, data: { color: '#e8a87c', label: 'C' } },
  { id: 'd', pose: { x:  80, y: 220, width: 100, height: 70 }, data: { color: '#5ba3c9', label: 'D' } },
  { id: 'e', pose: { x: 320, y: 260, width: 100, height: 70 }, data: { color: '#d4c4a8', label: 'E' } },
  { id: 'f', pose: { x: 560, y: 200, width: 100, height: 70 }, data: { color: '#e07b7b', label: 'F' } },
  { id: 'g', pose: { x: 160, y: 380, width: 100, height: 70 }, data: { color: '#f0d080', label: 'G' } },
  { id: 'h', pose: { x: 480, y: 380, width: 100, height: 70 }, data: { color: '#7fb069', label: 'H' } },
];
// The label is sized in screen pixels, so it reads the same at every zoom.
const boxData = ({ color, label }: { color: string; label: string }): TextNodeData => ({
  text: label,
  style: { fontFamily: 'sans-serif', fontSize: { px: 14 }, align: 'center' },
  verticalAlign: 'center',
  fill: { paint: solid('#1a130d') },
  background: { paint: solid(color) },
  edge: { width: 1.5, shade: 0.15 },
});

type Boundary = 'none' | 'stop' | 'bounce';
const BOUNDARY_ITEMS = (['none', 'stop', 'bounce'] as const).map((b) => ({ value: b, label: b }));
const BOUNDS = { minX: -20, maxX: 300, minY: -20, maxY: 200 };
const TEXT = createTextPreset({ editor: false });

export function ViewportDemo() {
  const [boundary, setBoundary] = useState<Boundary>('none');
  const [inertiaOn, setInertiaOn] = useState(true);
  const colorHex = useColorHex();
  const background = colorHex({ ref: 'workspace-surface' });
  const backgroundFill = useMemo(() => (background ? { color: background } : undefined), [background]);

  const scene = useScene<TextNodeData, Layer, RectPose>({
    systemLayers: [{ id: 'scene' }],
    initial: NODES.map((n) => ({ id: asNodeId(n.id), pose: n.pose, kind: 'mark' as const, layer: 'scene', data: boxData(n.data) })),
  });

  const inertiaConfig = inertiaOn
    ? {
        friction: 0.88,
        ...(boundary !== 'none' ? {
          boundary: boundary as 'stop' | 'bounce',
          bounds: BOUNDS,
        } : {}),
      }
    : false as const;

  return (
    <div className="ckd-demo">
      <div className="ckd-toolbar">
        <Checkbox isSelected={inertiaOn} onChange={setInertiaOn}>inertia</Checkbox>
        <Field orientation="row" label="boundary:">
          <SegmentedBar
            items={BOUNDARY_ITEMS}
            disabled={!inertiaOn}
            value={boundary}
            onChange={(b) => b && setBoundary(b)}
            size="sm"
          />
        </Field>
        <span className="ckd-hint">
          {boundary !== 'none' && inertiaOn ? `(bounds: x ${BOUNDS.minX}–${BOUNDS.maxX}, y ${BOUNDS.minY}–${BOUNDS.maxY})` : ''}
        </span>
      </div>
      <DemoStage width={480} height={320}>
        <SceneCanvas
          scene={scene}
          backgroundFill={backgroundFill}
          features={[viewPreset, TEXT]}
          viewport={{
            inertia: inertiaConfig,
            touchZoom: true,
            animatedZoom: true,
          }}
        />
      </DemoStage>
      <div className="ckd-hint">
        H / space = hand · drag fast + release = inertia · ⌘+= / ⌘+- / ⌘+0 = animated zoom (pan to interrupt) · pinch = zoom (touch multitouch; trackpad via ctrl+wheel, or Safari's gesture events)
      </div>
    </div>
  );
}
