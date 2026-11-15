/**
 * `Scene.replay`: another scene's recorded ops applied here, unrecorded.
 */
import type { SerializedOp, UnresolvableOp } from '@weasel-js/history';
import type { Op } from 'core/ops/types';

export interface SceneReplayEnv {
  /** Whether an edit is running, which a replay may not join. */
  open(): boolean;
  /** The op a `name` and `args` describe, as a restored history rebuilds it. */
  rebuild(name: string, args: unknown): Op | UnresolvableOp | null;
  /** Apply a step's ops as a history replays its own: unrecorded, all or
   *  nothing, with the lock guard lifted. */
  replaying(step: () => void): void;
  /** End the coalescing run, so no later edit merges across the change. */
  seal(): void;
  notify(): void;
}

export function replayOps(env: SceneReplayEnv, serialized: readonly SerializedOp[]): void {
  if (env.open()) throw new Error('Scene: cannot replay inside another edit');
  const built = serialized.map(({ name, args }) => {
    const op = env.rebuild(name, args);
    if (op === null) throw new Error(`Scene: cannot replay "${name}": no op of that name is registered`);
    if ('unresolved' in op) throw new Error(`Scene: cannot replay "${name}": ${op.unresolved}`);
    return op;
  });
  if (built.length === 0) return;
  env.replaying(() => { for (const op of built) op.apply(undefined); });
  env.seal();
  env.notify();
}
