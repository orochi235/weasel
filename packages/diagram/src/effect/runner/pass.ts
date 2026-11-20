import { getOwn, setOwn } from '@weasel-js/registry';
import { PREVIEW_SIZE, shownPorts, uniqueStages } from '../draw';
import type { EffectPipeline, EffectPort, EffectRun, EffectStage, EffectStageRun } from '../types';
import { runOrder } from './order';
import { paramValues } from './params';
import { closeBitmaps } from './previews';
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
  // The outputs of each stage that ran and was shown, which feed the stages after it.
  const made = new Map<string, Readonly<Record<string, unknown>>>();
  // Every stage's outputs, shown or not, for `dispose`.
  const owned: Array<[EffectStage, Readonly<Record<string, unknown>>]> = [];
  const sources = opts.sources ?? {};
  const size = typeof opts.previewSize === 'object' ? opts.previewSize
    : { width: opts.previewSize ?? PREVIEW_SIZE, height: opts.previewSize ?? PREVIEW_SIZE };
  const signal = opts.signal ?? new AbortController().signal;
  let run: EffectRun = { stages: {} };

  const kindOf = (type: string) => (opts.kinds ? getOwn(opts.kinds, type) : undefined);

  const inputsOf = (stage: EffectStage): Record<string, unknown> => {
    const many = new Set((stage.inputs ?? []).filter((i) => i.many === true).map((i) => i.id));
    const inputs = new Map<string, unknown>();
    for (const w of pipeline.wires) {
      if (w.to.stage !== stage.id || (inputs.has(w.to.port) && !many.has(w.to.port))) continue;
      const from = made.get(w.from.stage);
      const value = from && getOwn(from, w.from.port);
      if (value === undefined) continue;
      if (many.has(w.to.port)) inputs.set(w.to.port, [...(inputs.get(w.to.port) as unknown[] | undefined ?? []), value]);
      else inputs.set(w.to.port, value);
    }
    return Object.fromEntries(inputs);
  };

  // What the stage shows of each shown port: its text and its preview. Closes
  // the previews it made when a later one fails, and rethrows.
  const shown = async (stage: EffectStage, inputs: Readonly<Record<string, unknown>>, outputs: Readonly<Record<string, unknown>>) => {
    const values: Record<string, string> = {};
    const previews: Record<string, ImageBitmap> = {};
    try {
      for (const port of shownPorts(stage)) {
        const value = Object.hasOwn(outputs, port.id) ? outputs[port.id] : getOwn(inputs, port.id);
        if (value === undefined) continue;
        const kind = kindOf(port.type);
        const text = kind?.show !== undefined ? kind.show(value) : plainText(value);
        if (text !== undefined) setOwn(values, port.id, text);
        const preview = opts.previews === false ? undefined : await kind?.preview?.(value, size);
        if (preview !== undefined) setOwn(previews, port.id, preview);
      }
    } catch (err) {
      closeBitmaps(Object.values(previews));
      throw err;
    }
    return {
      ...(Object.keys(values).length > 0 ? { values } : {}),
      ...(Object.keys(previews).length > 0 ? { previews } : {}),
    };
  };

  // A stage's outputs are owned (and disposed) from the moment it hands them
  // back; they feed the stages after it only once it has shown them.
  const evaluate = async (stage: EffectStage, inputs: Record<string, unknown>) => {
    const start = performance.now();
    try {
      let outputs: Readonly<Record<string, unknown>>;
      let entry: EffectStageRun = {};
      if (stage.bypassed === true) outputs = passThrough(stage, inputs);
      else {
        const evaluator: EffectEvaluator | undefined = stage.type === undefined ? undefined : getOwn(opts.evaluators, stage.type);
        if (evaluator === undefined) throw new Error(`no evaluator for type "${stage.type ?? ''}"`);
        const result = await evaluator({ stage, inputs, params: paramValues(stage), sources, time: opts.time ?? 0, signal });
        outputs = result.outputs;
        entry = { cost: performance.now() - start, ...(result.taken !== undefined ? { taken: result.taken } : {}) };
      }
      owned.push([stage, outputs]);
      const full: EffectStageRun = { ...entry, ...(await shown(stage, inputs, outputs)) };
      made.set(stage.id, outputs);
      run = { stages: { ...run.stages, [stage.id]: full } };
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
      for (const [stage, outputs] of owned) {
        for (const port of stage.outputs ?? []) {
          const value = getOwn(outputs, port.id);
          if (value === undefined || given.has(value) || done.has(value)) continue;
          done.add(value);
          kindOf(port.type)?.dispose?.(value);
        }
      }
      made.clear();
      owned.length = 0;
    },
  };
}

/** Each output's value for a bypassed stage: its first input of the same type
 *  that has one, and of a `many` input, the first wire's value. */
function passThrough(stage: EffectStage, inputs: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const out = new Map<string, unknown>();
  const valueOf = (input: EffectPort): unknown => {
    const value = getOwn(inputs, input.id);
    return input.many === true ? (value as readonly unknown[] | undefined)?.[0] : value;
  };
  for (const port of stage.outputs ?? []) {
    const value = (stage.inputs ?? []).filter((i) => i.type === port.type).map(valueOf).find((v) => v !== undefined);
    if (value !== undefined) out.set(port.id, value);
  }
  return Object.fromEntries(out);
}

function plainText(value: unknown): string | undefined {
  return typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' ? String(value) : undefined;
}
