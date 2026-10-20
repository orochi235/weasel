import { PREVIEW_SIZE, uniqueStages } from '../draw';
import type { EffectPipeline, EffectRun, EffectStage, EffectStageRun } from '../types';
import { runOrder } from './order';
import type { EffectEvaluator, EffectEvaluators, EffectValueKinds } from './types';

/** Options for `runPipeline` and `createEffectRunner`. */
export interface RunPipelineOptions {
  /** By stage `type`. A stage whose type has none fails. */
  evaluators: EffectEvaluators;
  /** By value type. A value whose type has none shows as text when it is a
   *  number, string, or boolean, and has no preview. */
  kinds?: EffectValueKinds;
  /** Handed to every evaluator, for source stages. The run never disposes them. */
  sources?: Readonly<Record<string, unknown>>;
  /** Seconds of play time. Default 0. */
  time?: number;
  signal?: AbortSignal;
  /** Make a preview of each output whose kind can. Default true. */
  previews?: boolean;
  /** The size previews are made at: `RunRowOptions.previewSize`. Default `PREVIEW_SIZE`. */
  previewSize?: number | { width: number; height: number };
}

/** A run taken a stage at a time. */
export interface EffectPass {
  /** Evaluates the next stage the run reaches, passing over those it does
   *  not, and returns its id; `undefined` once none is left. */
  step(): Promise<string | undefined>;
  /** The run so far: a new object after each step. */
  readonly run: EffectRun;
  /** Disposes every value the pass made. Its previews are the caller's. */
  dispose(): void;
}

/** A pass over `pipeline` that has evaluated nothing yet. */
export function createPass(pipeline: EffectPipeline, opts: RunPipelineOptions): EffectPass {
  const stages = new Map(uniqueStages(pipeline).map((s) => [s.id, s]));
  const queue = runOrder(pipeline).order;
  const made = new Map<string, Readonly<Record<string, unknown>>>();
  const sources = opts.sources ?? {};
  const size = typeof opts.previewSize === 'object' ? opts.previewSize
    : { width: opts.previewSize ?? PREVIEW_SIZE, height: opts.previewSize ?? PREVIEW_SIZE };
  const signal = opts.signal ?? new AbortController().signal;
  let run: EffectRun = { stages: {} };

  const inputsOf = (stage: EffectStage): Record<string, unknown> => {
    const inputs: Record<string, unknown> = {};
    for (const w of pipeline.wires) {
      if (w.to.stage !== stage.id || inputs[w.to.port] !== undefined) continue;
      const value = made.get(w.from.stage)?.[w.from.port];
      if (value !== undefined) inputs[w.to.port] = value;
    }
    return inputs;
  };

  const record = async (stage: EffectStage, outputs: Readonly<Record<string, unknown>>, entry: EffectStageRun) => {
    made.set(stage.id, outputs);
    const values: Record<string, string> = {};
    const previews: Record<string, ImageBitmap> = {};
    for (const port of stage.outputs ?? []) {
      const value = outputs[port.id];
      if (value === undefined) continue;
      const kind = opts.kinds?.[port.type];
      const text = kind?.show !== undefined ? kind.show(value) : plainText(value);
      if (text !== undefined) values[port.id] = text;
      const preview = opts.previews === false ? undefined : await kind?.preview?.(value, size);
      if (preview !== undefined) previews[port.id] = preview;
    }
    const full: EffectStageRun = {
      ...entry,
      ...(Object.keys(values).length > 0 ? { values } : {}),
      ...(Object.keys(previews).length > 0 ? { previews } : {}),
    };
    run = { stages: { ...run.stages, [stage.id]: full } };
  };

  const evaluate = async (stage: EffectStage, inputs: Record<string, unknown>) => {
    if (stage.bypassed === true) return record(stage, passThrough(stage, inputs), {});
    const evaluator: EffectEvaluator | undefined = stage.type === undefined ? undefined : opts.evaluators[stage.type];
    const params = Object.fromEntries((stage.params ?? []).map((p) => [p.id ?? p.label, p.control?.value ?? p.value]));
    const start = performance.now();
    try {
      if (evaluator === undefined) throw new Error(`no evaluator for type "${stage.type ?? ''}"`);
      const result = await evaluator({ stage, inputs, params, sources, time: opts.time ?? 0, signal });
      const cost = performance.now() - start;
      return record(stage, result.outputs, { cost, ...(result.taken !== undefined ? { taken: result.taken } : {}) });
    } catch (err) {
      signal.throwIfAborted();
      const cost = performance.now() - start;
      run = { stages: { ...run.stages, [stage.id]: { cost, error: err instanceof Error ? err.message : String(err) } } };
    }
  };

  return {
    get run() { return run; },
    async step() {
      while (queue.length > 0) {
        signal.throwIfAborted();
        const stage = stages.get(queue.shift()!)!;
        const inputs = inputsOf(stage);
        if ((stage.inputs?.length ?? 0) > 0 && Object.keys(inputs).length === 0) continue;
        await evaluate(stage, inputs);
        signal.throwIfAborted();
        return stage.id;
      }
      return undefined;
    },
    dispose() {
      const given = new Set(Object.values(sources));
      const done = new Set<unknown>();
      for (const [id, outputs] of made) {
        for (const port of stages.get(id)?.outputs ?? []) {
          const value = outputs[port.id];
          if (value === undefined || given.has(value) || done.has(value)) continue;
          done.add(value);
          opts.kinds?.[port.type]?.dispose?.(value);
        }
      }
      made.clear();
    },
  };
}

/** Each output's value for a bypassed stage: its first input of the same type that has one. */
function passThrough(stage: EffectStage, inputs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const port of stage.outputs ?? []) {
    const from = (stage.inputs ?? []).find((i) => i.type === port.type && inputs[i.id] !== undefined);
    if (from !== undefined) out[port.id] = inputs[from.id];
  }
  return out;
}

function plainText(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? String(value) : undefined;
}
