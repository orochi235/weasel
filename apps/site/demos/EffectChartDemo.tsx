import { useState } from 'react';
import { EffectChart, rack, type EffectLook, type EffectPipeline } from '@weasel-js/diagram/effect';

const image = (id: string, label?: string) => ({ id, type: 'image', ...(label ? { label } : {}) });

const GROUND = { color: '#0e151b' } as const;

/** A source blurred only at high quality, then composited under sunbeams
 *  through a mask, with an oscillator driving the blur radius. */
export const PIPELINE: EffectPipeline = {
  types: { number: { control: true } },
  stages: [
    { id: 'src', title: 'Source', kind: 'source', outputs: [image('out')] },
    { id: 'q', title: 'high quality?', kind: 'decision', inputs: [image('in')], outputs: [image('yes', 'yes'), image('no', 'no')] },
    { id: 'blur', title: 'Blur', inputs: [image('image'), { id: 'radius', type: 'number' }], outputs: [image('out')],
      params: [{ label: 'radius', value: '6.0 px' }] },
    { id: 'mix', title: 'Composite', inputs: [image('base'), image('over'), { id: 'mask', type: 'mask' }], outputs: [image('out')],
      params: [{ label: 'blend', value: 'screen' }] },
    { id: 'out', title: 'Out', kind: 'sink', inputs: [image('in')] },
    { id: 'osc', title: 'Oscillator', outputs: [{ id: 'value', type: 'number' }] },
    { id: 'beams', title: 'Sunbeams', outputs: [image('out')] },
    { id: 'cutout', title: 'Mask', outputs: [{ id: 'out', type: 'mask' }] },
  ],
  wires: [
    { from: { stage: 'src', port: 'out' }, to: { stage: 'q', port: 'in' } },
    { from: { stage: 'q', port: 'yes' }, to: { stage: 'blur', port: 'image' } },
    { from: { stage: 'q', port: 'no' }, to: { stage: 'mix', port: 'base' } },
    { from: { stage: 'blur', port: 'out' }, to: { stage: 'mix', port: 'base' } },
    { from: { stage: 'mix', port: 'out' }, to: { stage: 'out', port: 'in' } },
    { from: { stage: 'osc', port: 'value' }, to: { stage: 'blur', port: 'radius' } },
    { from: { stage: 'beams', port: 'out' }, to: { stage: 'mix', port: 'over' } },
    { from: { stage: 'cutout', port: 'out' }, to: { stage: 'mix', port: 'mask' } },
  ],
};

function Demo<TOptions>({ look }: { look?: EffectLook<TOptions> }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">picked: {picked ?? 'none'}</div>
      <EffectChart
        pipeline={PIPELINE}
        {...(look ? { look } : {})}
        background={GROUND}
        width={820}
        height={420}
        selected={picked}
        onSelect={setPicked}
        className="ckd-canvas"
      />
    </div>
  );
}

export function EffectChartDemo() {
  return <Demo />;
}

export function EffectChartRackDemo() {
  return <Demo look={rack} />;
}
