import type { EffectStage } from '../types';

/** What an evaluator is handed for one stage of one run. */
export interface EffectEvalContext {
  stage: EffectStage;
  /** The value on each input a wire feeds, by port id. An input no reached
   *  wire feeds is absent. */
  inputs: Readonly<Record<string, unknown>>;
  /** Each param's control value (its display string when it has no
   *  control), by param id, or by label for a param without one. */
  params: Readonly<Record<string, unknown>>;
  /** The values the run was handed (`RunPipelineOptions.sources`), for a
   *  source stage to read. */
  sources: Readonly<Record<string, unknown>>;
  /** Seconds of play time. */
  time: number;
  /** Aborted when the run is abandoned. */
  signal: AbortSignal;
}

/** What one stage produced: a value per output it fed, by port id, and for a
 *  decision the output it chose. An output left out feeds nothing. */
export interface EffectEvalResult {
  outputs: Readonly<Record<string, unknown>>;
  taken?: string;
}

/** Evaluates one stage. Throw to fail it: the run records the message as the
 *  stage's `error` and leaves what it feeds unreached. */
export type EffectEvaluator = (ctx: EffectEvalContext) => EffectEvalResult | Promise<EffectEvalResult>;

/** Evaluators by stage `type`. */
export type EffectEvaluators = Readonly<Record<string, EffectEvaluator>>;

/** How a run shows, previews, and lets go of the values of one value type. */
export interface EffectValueKind {
  /** The value as text for a value row. Default `String(value)` for a
   *  number, string, or boolean, and nothing for anything else. */
  show?(value: unknown): string;
  /** The value as a picture of `size`, for a preview slot. */
  preview?(value: unknown, size: { width: number; height: number }): ImageBitmap | Promise<ImageBitmap> | undefined;
  /** Frees what the value holds, once nothing reads it again. */
  dispose?(value: unknown): void;
}

/** Value kinds by value type. */
export type EffectValueKinds = Readonly<Record<string, EffectValueKind>>;
