import { describe, expect, it, vi } from 'vitest';
import type { EffectPipeline, EffectStage } from '../types';
import { createEffectRunner } from './runner';
import type { EffectEvaluators, EffectValueKinds } from './types';

const num = (id: string) => ({ id, type: 'number' });
const stage = (id: string, type: string, inputs: string[] = []): EffectStage => ({
  id, title: id, type, inputs: inputs.map(num), outputs: [num('out')],
});
const PIPELINE: EffectPipeline = {
  stages: [stage('t', 'clock'), stage('a', 'inc', ['in']), stage('b', 'inc', ['in'])],
  wires: [
    { from: { stage: 't', port: 'out' }, to: { stage: 'a', port: 'in' } },
    { from: { stage: 'a', port: 'out' }, to: { stage: 'b', port: 'in' } },
  ],
};
const EVAL: EffectEvaluators = {
  clock: ({ time }) => ({ outputs: { out: time } }),
  inc: ({ inputs }) => ({ outputs: { out: (inputs.in as number) + 1 } }),
};

/** A stand-in bitmap that records being closed. */
const bitmap = () => {
  const b = { closed: false, close: () => { b.closed = true; } };
  return b as unknown as ImageBitmap & { closed: boolean };
};
const PREVIEWED: EffectValueKinds = { number: { preview: () => bitmap() } };

const settled = () => new Promise((r) => setTimeout(r, 0));

describe('createEffectRunner', () => {
  it('runs the whole pipeline and tells its subscribers', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL });
    const heard = vi.fn();
    runner.subscribe(heard);
    await runner.run();
    expect(runner.state.run?.stages.b?.values).toEqual({ out: '2' });
    expect(heard).toHaveBeenCalled();
  });

  it('steps one stage at a time, at the stage it just evaluated, and starts over after the last', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL });
    await runner.step();
    expect(runner.state.run).toMatchObject({ at: 't' });
    expect(Object.keys(runner.state.run!.stages)).toEqual(['t']);
    await runner.step();
    await runner.step();
    expect(runner.state.run).toMatchObject({ at: 'b' });
    expect(runner.state.run!.stages.b!.values).toEqual({ out: '2' });
    await runner.step();
    expect(runner.state.run).toMatchObject({ at: 't' });
    expect(Object.keys(runner.state.run!.stages)).toEqual(['t']);
  });

  it('resets to no run, no play, and the clock at zero', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL });
    runner.play();
    runner.advance(2);
    await settled();
    runner.reset();
    expect(runner.state).toMatchObject({ run: undefined, playing: false, time: 0 });
  });

  it('plays: each frame advances the clock and starts a run only once the last has finished', async () => {
    let finish!: () => void;
    const slow: EffectEvaluators = { ...EVAL, inc: async (ctx) => { await new Promise<void>((r) => { finish = r; }); return EVAL.inc!(ctx); } };
    const runner = createEffectRunner({ pipeline: { ...PIPELINE, stages: PIPELINE.stages.slice(0, 2) }, evaluators: slow });
    const clock = vi.fn(EVAL.clock!);
    runner.setOptions({ evaluators: { ...slow, clock } });
    runner.advance(1);
    expect(clock).not.toHaveBeenCalled();
    runner.play();
    runner.advance(0.5);
    runner.advance(0.25);
    await settled();
    expect(clock).toHaveBeenCalledTimes(1);
    finish();
    await settled();
    expect(runner.state.run!.stages.t!.values).toEqual({ out: '0.5' });
    runner.advance(0.25);
    await settled();
    expect(clock).toHaveBeenCalledTimes(2);
    expect(runner.state.time).toBe(1);
    finish();
    await settled();
    expect(runner.state.run!.stages.a!.values).toEqual({ out: '2' });
    runner.pause();
    runner.advance(5);
    await settled();
    expect(clock).toHaveBeenCalledTimes(2);
  });

  it('follows a new pipeline on the next run', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL });
    runner.setPipeline({ ...PIPELINE, stages: [PIPELINE.stages[0]!], wires: [] });
    await runner.run();
    expect(Object.keys(runner.state.run!.stages)).toEqual(['t']);
  });

  it('closes an older run\'s previews once a newer run is drawn, keeping any the newer one still shows', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL, kinds: PREVIEWED });
    await runner.step();
    const first = runner.state.run!;
    const kept = first.stages.t!.previews!.out as ImageBitmap & { closed: boolean };
    await runner.step();
    await runner.run();
    const third = runner.state.run!;
    expect(kept.closed).toBe(false);
    runner.drawn(third);
    expect(kept.closed).toBe(true);
    const current = third.stages.b!.previews!.out as ImageBitmap & { closed: boolean };
    expect(current.closed).toBe(false);
    runner.dispose();
    expect(current.closed).toBe(true);
  });

  it('keeps the previews a step run carries forward from one step to the next', async () => {
    const runner = createEffectRunner({ pipeline: PIPELINE, evaluators: EVAL, kinds: PREVIEWED });
    await runner.step();
    const t = runner.state.run!.stages.t!.previews!.out as ImageBitmap & { closed: boolean };
    await runner.step();
    runner.drawn(runner.state.run);
    expect(t.closed).toBe(false);
  });
});
