import { useState } from 'react';
import { EffectChart, rack, type EffectLook, type EffectPipeline } from '@weasel-js/diagram/effect';

const image = (id: string, label?: string) => ({ id, type: 'image', ...(label ? { label } : {}) });
const wire = (from: string, to: string) => {
  const [fs, fp] = from.split('.');
  const [ts, tp] = to.split('.');
  return { from: { stage: fs!, port: fp! }, to: { stage: ts!, port: tp! } };
};

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
    wire('src.out', 'q.in'), wire('q.yes', 'blur.image'), wire('q.no', 'mix.base'), wire('blur.out', 'mix.base'),
    wire('mix.out', 'out.in'), wire('osc.value', 'blur.radius'), wire('beams.out', 'mix.over'), wire('cutout.out', 'mix.mask'),
  ],
};

function Demo({ look }: { look?: EffectLook }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="ckd-stack">
      <div className="ckd-row">picked: {picked ?? 'none'}</div>
      <EffectChart
        pipeline={PIPELINE}
        {...(look ? { look } : {})}
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
  return <Demo look={rack as EffectLook} />;
}
