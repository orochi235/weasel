import { useEffect, useMemo, useState } from 'react';
import { useVisibleRaf } from '@weasel-js/core';
import {
  BRANCH_SYMBOLS, EffectChart, compact, lanes, nodeGraph, rack,
  type BranchChoice, type EffectLook, type EffectPipeline, type EffectRun, type EffectStageRun,
} from '@weasel-js/diagram/effect';
import { Select } from '@weasel-js/ui/components/Select';
import { DemoStage } from './DemoStage';

const image = (id: string, label?: string) => ({ id, type: 'image', ...(label ? { label } : {}) });

const GROUND = { color: '#0e151b' } as const;
const W = 820, H = 420;

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
      <DemoStage width={W} height={H}>
        <EffectChart
          pipeline={PIPELINE}
          {...(look ? { look } : {})}
          background={GROUND}
          selected={picked}
          onSelect={setPicked}
          className="ckd-canvas"
        />
      </DemoStage>
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
    <DemoStage width={W} height={H}>
      <EffectChart
        pipeline={PIPELINE}
        run={runAt(frame)}
        options={SHOW_VALUES}
        background={GROUND}
        className="ckd-canvas"
      />
    </DemoStage>
  );
}

const SHOW_PREVIEWS = { showPreviews: true, previewSize: { width: 64, height: 36 } };

/** A frame of a stand-in picture for one output: a band of `hue` sweeping across. */
function thumbnail(scratch: OffscreenCanvas, hue: number, t: number): ImageBitmap {
  const ctx = scratch.getContext('2d')!;
  ctx.fillStyle = `hsl(${hue} 40% 18%)`;
  ctx.fillRect(0, 0, scratch.width, scratch.height);
  ctx.fillStyle = `hsl(${hue} 80% 60%)`;
  ctx.fillRect(((t * 30 + hue) % (scratch.width + 16)) - 16, 0, 16, scratch.height);
  return scratch.transferToImageBitmap();
}

/** `runAt(frame)` with a new preview on every output the run reached. */
function withPreviews(run: EffectRun, scratch: OffscreenCanvas, frame: number): EffectRun {
  const stages = Object.fromEntries(PIPELINE.stages.flatMap((stage, i): [string, EffectStageRun][] => {
    const ran = run.stages[stage.id];
    if (ran === undefined) return [];
    const previews = Object.fromEntries((stage.outputs ?? []).map((p): [string, ImageBitmap] => [p.id, thumbnail(scratch, i * 47, frame / 60)]));
    return [[stage.id, { ...ran, previews }]];
  }));
  return { stages };
}

export function EffectChartPreviewDemo() {
  const [scratch] = useState(() => new OffscreenCanvas(SHOW_PREVIEWS.previewSize.width, SHOW_PREVIEWS.previewSize.height));
  const [frame, setFrame] = useState(0);
  const loop = useVisibleRaf((_now, loop) => {
    loop.request();
    setFrame((f) => f + 1);
  });
  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);
  const run = useMemo(() => withPreviews(runAt(frame), scratch, frame), [frame, scratch]);
  return (
    <DemoStage width={W} height={H}>
      <EffectChart
        pipeline={PIPELINE}
        run={run}
        options={SHOW_PREVIEWS}
        background={GROUND}
        className="ckd-canvas"
      />
    </DemoStage>
  );
}

export function EffectChartRackDemo() {
  return <Demo look={rack} />;
}

export function EffectChartLanesDemo() {
  return <Demo look={lanes} />;
}

export function EffectChartCompactDemo() {
  return <Demo look={compact} />;
}

const level = (id: string) => ({ id, type: 'audio' });

/** A level split three ways, and a gate a control value opens. */
const BRANCHES: EffectPipeline = {
  types: { gate: { control: true } },
  stages: [
    { id: 'in', title: 'Input', kind: 'source', outputs: [level('out')] },
    { id: 'band', title: 'Loudness', kind: 'decision', inputs: [level('in')],
      outputs: [level('quiet'), level('mid'), level('loud')], split: { input: 'in', at: [-30, -12] } },
    { id: 'boost', title: 'Boost', inputs: [level('in')], outputs: [level('out')] },
    { id: 'keep', title: 'Keep', inputs: [level('in')], outputs: [level('out')] },
    { id: 'limit', title: 'Limit', inputs: [level('in')], outputs: [level('out')] },
    { id: 'key', title: 'Sidechain', outputs: [{ id: 'open', type: 'gate' }] },
    { id: 'gate', title: 'open?', kind: 'decision', inputs: [level('in'), { id: 'when', type: 'gate' }],
      outputs: [level('yes'), level('no')] },
    { id: 'out', title: 'Output', kind: 'sink', inputs: [level('in')] },
  ],
  wires: [
    { from: { stage: 'in', port: 'out' }, to: { stage: 'band', port: 'in' } },
    { from: { stage: 'band', port: 'quiet' }, to: { stage: 'boost', port: 'in' } },
    { from: { stage: 'band', port: 'mid' }, to: { stage: 'keep', port: 'in' } },
    { from: { stage: 'band', port: 'loud' }, to: { stage: 'limit', port: 'in' } },
    { from: { stage: 'keep', port: 'out' }, to: { stage: 'gate', port: 'in' } },
    { from: { stage: 'key', port: 'open' }, to: { stage: 'gate', port: 'when' } },
    { from: { stage: 'gate', port: 'yes' }, to: { stage: 'out', port: 'in' } },
  ],
};

const CHOICES = ['auto', ...Object.keys(BRANCH_SYMBOLS)] as BranchChoice[];

export function EffectChartBranchDemo() {
  const [branch, setBranch] = useState<BranchChoice>('crossover');
  const options = useMemo(() => ({ branch }), [branch]);
  return (
    <div className="ckd-stack">
      <Select
        label="branch symbol"
        orientation="row"
        width="fit"
        options={CHOICES.map((c) => ({ value: c, label: c }))}
        selectedKey={branch}
        onSelectionChange={setBranch}
      />
      <DemoStage width={W} height={H}>
        <EffectChart
          pipeline={BRANCHES}
          look={nodeGraph}
          options={options}
          background={GROUND}
          className="ckd-canvas"
        />
      </DemoStage>
    </div>
  );
}
