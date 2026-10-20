import { describe, expect, it, vi } from 'vitest';
import type { EffectPipeline, EffectStage } from '../types';
import { runPipeline } from './runPipeline';
import type { EffectEvaluators } from './types';

const num = (id: string) => ({ id, type: 'number' });
const stage = (id: string, type: string, inputs: string[] = [], outputs: string[] = ['out'], extra: Partial<EffectStage> = {}): EffectStage => ({
  id, title: id, type, inputs: inputs.map(num), outputs: outputs.map(num), ...extra,
});
const wire = (from: string, to: string, fromPort = 'out', toPort = 'in') => ({ from: { stage: from, port: fromPort }, to: { stage: to, port: toPort } });

/** Numbers through: a source of 2, a doubler, an adder, and a sign test. */
const EVAL: EffectEvaluators = {
  two: () => ({ outputs: { out: 2 } }),
  double: ({ inputs }) => ({ outputs: { out: (inputs.in as number) * 2 } }),
  add: ({ inputs, params }) => ({ outputs: { out: (inputs.in as number) + (params.by as number) } }),
  sign: ({ inputs }) => {
    const v = inputs.in as number;
    return v > 0 ? { outputs: { pos: v }, taken: 'pos' } : { outputs: { neg: v }, taken: 'neg' };
  },
  fail: () => { throw new Error('broke'); },
  clock: ({ time }) => ({ outputs: { out: time } }),
  given: ({ sources }) => ({ outputs: { out: sources.n } }),
};

describe('runPipeline', () => {
  it('evaluates stages in order, feeding each its wired inputs and its params, and shows each value', async () => {
    const p: EffectPipeline = {
      stages: [
        stage('add', 'add', ['in'], ['out'], { params: [{ id: 'by', label: 'by', value: '1', control: { kind: 'number', value: 1 } }] }),
        stage('dbl', 'double', ['in']),
        stage('src', 'two'),
      ],
      wires: [wire('src', 'dbl'), wire('dbl', 'add')],
    };
    const run = await runPipeline(p, { evaluators: EVAL });
    expect(run.stages.src!.values).toEqual({ out: '2' });
    expect(run.stages.dbl!.values).toEqual({ out: '4' });
    expect(run.stages.add!.values).toEqual({ out: '5' });
    expect(run.stages.add!.cost).toBeGreaterThanOrEqual(0);
  });

  it('records the output a decision took, and skips the stages its other output feeds', async () => {
    const p: EffectPipeline = {
      stages: [stage('src', 'two'), stage('test', 'sign', ['in'], ['pos', 'neg']), stage('up', 'double', ['in']), stage('down', 'double', ['in'])],
      wires: [wire('src', 'test'), wire('test', 'up', 'pos'), wire('test', 'down', 'neg')],
    };
    const run = await runPipeline(p, { evaluators: EVAL });
    expect(run.stages.test!.taken).toBe('pos');
    expect(run.stages.up!.values).toEqual({ out: '4' });
    expect(run.stages.down).toBeUndefined();
  });

  it('skips a stage whose inputs nothing reaches, and runs one with no inputs at all', async () => {
    const p: EffectPipeline = { stages: [stage('lone', 'double', ['in']), stage('src', 'two')], wires: [] };
    const run = await runPipeline(p, { evaluators: EVAL });
    expect(Object.keys(run.stages)).toEqual(['src']);
  });

  it('passes a bypassed stage\'s first input of each output\'s type through, evaluating nothing', async () => {
    const double = vi.fn(EVAL.double!);
    const p: EffectPipeline = {
      stages: [stage('src', 'two'), stage('dbl', 'double', ['in'], ['out'], { bypassed: true }), stage('after', 'double', ['in'])],
      wires: [wire('src', 'dbl'), wire('dbl', 'after')],
    };
    const run = await runPipeline(p, { evaluators: { ...EVAL, double } });
    expect(run.stages.dbl).toEqual({ values: { out: '2' } });
    expect(run.stages.after!.values).toEqual({ out: '4' });
    expect(double).toHaveBeenCalledTimes(1);
  });

  it('records a throwing stage\'s error and leaves what it feeds unreached', async () => {
    const p: EffectPipeline = { stages: [stage('src', 'two'), stage('bad', 'fail', ['in']), stage('after', 'double', ['in'])], wires: [wire('src', 'bad'), wire('bad', 'after')] };
    const run = await runPipeline(p, { evaluators: EVAL });
    expect(run.stages.bad!.error).toBe('broke');
    expect(run.stages.bad!.cost).toBeGreaterThanOrEqual(0);
    expect(run.stages.after).toBeUndefined();
  });

  it('fails a stage whose type has no evaluator', async () => {
    const run = await runPipeline({ stages: [stage('x', 'mystery')], wires: [] }, { evaluators: EVAL });
    expect(run.stages.x!.error).toMatch(/mystery/);
  });

  it('never runs the stages of a cycle', async () => {
    const p: EffectPipeline = {
      stages: [stage('src', 'two'), stage('a', 'double', ['in', 'back']), stage('b', 'double', ['in'])],
      wires: [wire('src', 'a'), wire('a', 'b'), wire('b', 'a', 'out', 'back')],
    };
    const run = await runPipeline(p, { evaluators: EVAL });
    expect(Object.keys(run.stages)).toEqual(['src']);
  });

  it('hands every evaluator the time and the sources', async () => {
    const p: EffectPipeline = { stages: [stage('t', 'clock'), stage('g', 'given')], wires: [] };
    const run = await runPipeline(p, { evaluators: EVAL, time: 1.5, sources: { n: 7 } });
    expect(run.stages.t!.values).toEqual({ out: '1.5' });
    expect(run.stages.g!.values).toEqual({ out: '7' });
  });

  it('shows, previews, and then disposes each value it made through its kind, but never a source', async () => {
    const shown = { kind: 'bitmap' } as unknown as ImageBitmap;
    const dispose = vi.fn();
    const source = 3;
    const p: EffectPipeline = { stages: [stage('g', 'given'), stage('dbl', 'double', ['in'])], wires: [wire('g', 'dbl')] };
    const run = await runPipeline(p, {
      evaluators: EVAL,
      sources: { n: source },
      kinds: { number: { show: (v) => `#${v as number}`, preview: () => shown, dispose } },
    });
    expect(run.stages.dbl).toMatchObject({ values: { out: '#6' }, previews: { out: shown } });
    expect(dispose.mock.calls).toEqual([[6]]);
  });

  it('shows and previews what reached a stage with no outputs, on its inputs', async () => {
    const shown = { kind: 'bitmap' } as unknown as ImageBitmap;
    const p: EffectPipeline = { stages: [stage('src', 'two'), stage('end', 'sink', ['in'], [])], wires: [wire('src', 'end')] };
    const run = await runPipeline(p, { evaluators: { ...EVAL, sink: () => ({ outputs: {} }) }, kinds: { number: { preview: () => shown } } });
    expect(run.stages.end).toMatchObject({ values: { in: '2' }, previews: { in: shown } });
  });

  it('rejects once its signal aborts, and evaluates nothing after', async () => {
    const controller = new AbortController();
    const after = vi.fn(EVAL.double!);
    const p: EffectPipeline = { stages: [stage('src', 'two'), stage('dbl', 'double', ['in'])], wires: [wire('src', 'dbl')] };
    const pending = runPipeline(p, {
      evaluators: { ...EVAL, two: () => { controller.abort(); return { outputs: { out: 2 } }; }, double: after },
      signal: controller.signal,
    });
    await expect(pending).rejects.toThrow();
    expect(after).not.toHaveBeenCalled();
  });
});
