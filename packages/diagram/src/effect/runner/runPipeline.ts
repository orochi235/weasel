import type { EffectPipeline, EffectRun } from '../types';
import { createPass, type RunPipelineOptions } from './pass';

/**
 * One whole run of `pipeline`, stage by stage in `runOrder`. A stage with
 * inputs none of which a value reaches is skipped; a bypassed stage passes its
 * first input of each output's type through; a throwing evaluator sets the
 * stage's `error` and leaves what it feeds unreached; stages on a cycle never
 * run. Every value the run made is disposed before it resolves; the previews
 * in the run are the caller's to close. Rejects once `signal` aborts.
 */
export async function runPipeline(pipeline: EffectPipeline, opts: RunPipelineOptions): Promise<EffectRun> {
  const pass = createPass(pipeline, opts);
  try {
    while ((await pass.step()) !== undefined);
    return pass.run;
  } finally {
    pass.dispose();
  }
}
