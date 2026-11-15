import { useState } from 'react';
import { SceneCanvas, useScene, HOME_VIEW, fitViewToBounds, solid, viewPreset } from '@weasel-js/core';
import type { Fill, Stroke, View } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Field } from '@weasel-js/ui/components/Field';
import { Select } from '@weasel-js/ui/components/Select';
import { Slider } from '@weasel-js/ui/components/Slider';
import s from './PerAxisZoomDemo.module.css';
import { DemoStage } from './DemoStage';

interface NodeData { shape: 'rect'; fill: Fill; stroke: Stroke }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
// Non-square bounds so 'contain' / 'fill' / 'stretch' look visibly different.
const IMAGE_BOUNDS = { x: 0, y: 0, width: 400, height: 200 };
const START: View = { x: -100, y: -100, scale: { x: 1, y: 1 } };
type FitMode = 'contain' | 'fill' | 'stretch';
const FIT_MODES = (['contain', 'fill', 'stretch'] as const).map((m) => ({ value: m, label: m }));

function AxisScale({ axis, view, onChange }: { axis: 'x' | 'y'; view: View; onChange: (v: View) => void }) {
  const value = view.scale[axis];
  return (
    <Field orientation="row" label={`scale.${axis}`} output={value.toFixed(2)} className={s.axis}>
      <Slider
        min={0.25} max={4} step={0.05}
        thumbs={[{ value }]}
        onInput={(ts) => onChange({ ...view, scale: { ...view.scale, [axis]: ts[0].value } })}
      />
    </Field>
  );
}

export function PerAxisZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'image' as never, kind: 'mark', layer: 'default', pose: IMAGE_BOUNDS,
        data: { shape: 'rect', fill: { paint: solid('#7fb069') }, stroke: { paint: solid('#d4c4a8'), width: 2 } } },
    ],
  });
  const [view, setView] = useState<View>(START);
  const [mode, setMode] = useState<FitMode>('contain');
  const [size, setSize] = useState({ width: W, height: H });

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <AxisScale axis="x" view={view} onChange={setView} />
        <AxisScale axis="y" view={view} onChange={setView} />
        <Select
          label="mode"
          orientation="row"
          width="fit"
          options={FIT_MODES}
          selectedKey={mode}
          onSelectionChange={setMode}
        />
        <Button onClick={() => setView(fitViewToBounds(IMAGE_BOUNDS, size, view, { mode }) ?? HOME_VIEW)}>Fit</Button>
        <Button onClick={() => setView(START)}>Reset</Button>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={[viewPreset]}
          className="ckd-canvas"
          scene={scene}
          view={view}
          onViewChange={setView}
          onResize={setSize}
        />
      </DemoStage>
    </div>
  );
}
