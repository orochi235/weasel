import { useEffect, useState } from 'react';
import { useVisibleRaf } from '@weasel-js/core';
import { EffectChart, rack, type EffectLook, type EffectPipeline, type EffectRun } from '@weasel-js/diagram/effect';

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

/** Kept steady, so the chart lays out once. */
const SHOW_VALUES = { showValues: true };

/** The pipeline's run `frame` frames in: the oscillator swings the blur
 *  radius, and every two seconds the quality check flips, skipping the blur. */
export function runAt(frame: number): EffectRun {
  const t = frame / 60;
  const radius = 6 + 4 * Math.sin(t * 2);
  const high = Math.floor(t / 2) % 2 === 0;
  return {
    stages: {
      src: { cost: 0.3, values: { out: '1920×1080' } },
      q: { cost: 0.01, taken: high ? 'yes' : 'no' },
      ...(high ? { blur: { cost: 1.5 + radius * 0.4, values: { out: `${radius.toFixed(1)} px` } } } : {}),
      osc: { cost: 0.02, values: { value: radius.toFixed(2) } },
      beams: { cost: 0.8, values: { out: 'rays' } },
      cutout: { cost: 0.1, values: { out: 'circle' } },
      mix: { cost: 1.1, values: { out: high ? 'soft' : 'sharp' } },
      out: {},
    },
  };
}

export function EffectChartRunDemo() {
  const [frame, setFrame] = useState(0);
  const loop = useVisibleRaf((_now, loop) => {
    loop.request();
    setFrame((f) => f + 1);
  });
  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);
  return (
    <EffectChart
      pipeline={PIPELINE}
      run={runAt(frame)}
      options={SHOW_VALUES}
      background={GROUND}
      width={820}
      height={420}
      className="ckd-canvas"
    />
  );
}

export function EffectChartRackDemo() {
  return <Demo look={rack} />;
}
