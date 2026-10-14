/** Pipelines to try looks against. `broken` is wrong on purpose. */
import type { EffectPipeline, EffectPort, EffectStage, EffectWire } from '../types';

const img = (id: string, label?: string): EffectPort => ({ id, type: 'image', ...(label ? { label } : {}) });
const num = (id: string): EffectPort => ({ id, type: 'number' });
const mask = (id: string): EffectPort => ({ id, type: 'mask' });
const w = (from: string, to: string, label?: string): EffectWire => {
  const [fs, fp] = from.split('.');
  const [ts, tp] = to.split('.');
  return { from: { stage: fs!, port: fp! }, to: { stage: ts!, port: tp! }, ...(label ? { label } : {}) };
};
const TYPES = { number: { control: true } };

const source: EffectStage = { id: 'src', title: 'Source', kind: 'source', outputs: [img('out')] };
const sink: EffectStage = { id: 'out', title: 'Out', kind: 'sink', inputs: [img('in')] };
const blur: EffectStage = {
  id: 'blur', title: 'Blur', inputs: [img('image'), num('radius')], outputs: [img('out')],
  params: [{ label: 'radius', value: '6.0 px' }, { label: 'passes', value: '2' }],
};
const mix: EffectStage = {
  id: 'mix', title: 'Composite', inputs: [img('base'), img('over'), mask('mask')], outputs: [img('out')],
  params: [{ label: 'blend', value: 'screen' }, { label: 'opacity', value: '0.80' }],
};
const osc: EffectStage = { id: 'osc', title: 'Oscillator', outputs: [num('value')], params: [{ label: 'rate', value: '0.5 Hz' }] };
const beams: EffectStage = { id: 'beams', title: 'Sunbeams', outputs: [img('out')] };
const cutout: EffectStage = { id: 'cutout', title: 'Mask', outputs: [mask('out')] };

const chain: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { id: 'tone', title: 'Tone', inputs: [img('in')], outputs: [img('out')], params: [{ label: 'gamma', value: '2.2' }] },
    { ...blur, inputs: [img('image')] },
    { id: 'grain', title: 'Grain', bypassed: true, inputs: [img('in')], outputs: [img('out')] },
    sink,
  ],
  wires: [w('src.out', 'tone.in'), w('tone.out', 'blur.image'), w('blur.out', 'grain.in'), w('grain.out', 'out.in')],
};

const sideInputs: EffectPipeline = {
  types: TYPES,
  stages: [source, blur, mix, sink, osc, beams, cutout],
  wires: [
    w('src.out', 'blur.image'), w('blur.out', 'mix.base'), w('mix.out', 'out.in'),
    w('osc.value', 'blur.radius'), w('beams.out', 'mix.over'), w('cutout.out', 'mix.mask'),
  ],
};

const gate: EffectStage = {
  id: 'q', title: 'high quality?', kind: 'decision', inputs: [img('in')], outputs: [img('yes', 'yes'), img('no', 'no')],
};

const skip: EffectPipeline = {
  types: TYPES,
  stages: [source, gate, blur, mix, sink, osc, beams, cutout],
  wires: [
    w('src.out', 'q.in'), w('q.yes', 'blur.image'), w('q.no', 'mix.base'), w('blur.out', 'mix.base'),
    w('mix.out', 'out.in'), w('osc.value', 'blur.radius'), w('beams.out', 'mix.over'), w('cutout.out', 'mix.mask'),
  ],
};

const branch: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { ...gate, title: 'has alpha?' },
    { id: 'matte', title: 'Matte', inputs: [img('in')], outputs: [img('out')] },
    { id: 'flat', title: 'Flatten', inputs: [img('in')], outputs: [img('out')] },
    { id: 'join', title: 'Merge', inputs: [img('a'), img('b')], outputs: [img('out')] },
    sink,
  ],
  wires: [
    w('src.out', 'q.in'), w('q.yes', 'matte.in'), w('q.no', 'flat.in'),
    w('matte.out', 'join.a'), w('flat.out', 'join.b'), w('join.out', 'out.in'),
  ],
  groups: [{ id: 'alpha', label: 'Alpha handling', members: ['matte', 'flat'] }],
};

const bands: EffectPipeline = {
  types: TYPES,
  stages: [
    source,
    { id: 'level', title: 'Luma', inputs: [img('in')], outputs: [num('value')] },
    { id: 'band', title: 'Brightness', kind: 'decision', inputs: [img('in'), num('x')],
      outputs: [img('low', 'low'), img('mid', 'mid'), img('high', 'high')], split: { input: 'x', at: [0.2, 0.8] } },
    { id: 'lift', title: 'Lift', inputs: [img('in')], outputs: [img('out')] },
    { id: 'keep', title: 'Pass', inputs: [img('in')], outputs: [img('out')] },
    { id: 'clip', title: 'Soft clip', inputs: [img('in')], outputs: [img('out')] },
    { id: 'join', title: 'Merge', inputs: [img('a'), img('b'), img('c')], outputs: [img('out')] },
    sink,
  ],
  wires: [
    w('src.out', 'level.in'), w('src.out', 'band.in'), w('level.value', 'band.x'),
    w('band.low', 'lift.in'), w('band.mid', 'keep.in'), w('band.high', 'clip.in'),
    w('lift.out', 'join.a'), w('keep.out', 'join.b'), w('clip.out', 'join.c'), w('join.out', 'out.in'),
  ],
};

/** A long chain with a modulator on every third stage. */
function large(): EffectPipeline {
  const stages: EffectStage[] = [source];
  const wires: EffectWire[] = [];
  let last = 'src.out';
  for (let i = 0; i < 28; i++) {
    const id = `fx${i}`;
    const modulated = i % 3 === 0;
    stages.push({ id, title: `Effect ${i + 1}`, inputs: modulated ? [img('in'), num('amount')] : [img('in')], outputs: [img('out')] });
    wires.push(w(last, `${id}.in`));
    if (modulated) {
      stages.push({ id: `lfo${i}`, title: `LFO ${i / 3 + 1}`, outputs: [num('value')] });
      wires.push(w(`lfo${i}.value`, `${id}.amount`));
    }
    last = `${id}.out`;
  }
  stages.push(sink);
  wires.push(w(last, 'out.in'));
  return { types: TYPES, stages, wires };
}

const broken: EffectPipeline = {
  types: TYPES,
  stages: [source, blur, mix, sink, osc],
  wires: [
    w('src.out', 'blur.image'), w('blur.out', 'mix.base'), w('mix.out', 'out.in'),
    w('osc.value', 'mix.over'),
    w('ghost.out', 'mix.mask'),
    w('blur.image', 'mix.over'),
  ],
  groups: [{ id: 'g', label: 'Missing', members: ['blur', 'nowhere'] }],
};

export const SAMPLES: Readonly<Record<string, EffectPipeline>> = Object.freeze({
  chain,
  branch,
  sideInputs,
  skip,
  bands,
  large: large(),
  broken,
});
