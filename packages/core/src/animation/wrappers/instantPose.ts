import type { SceneAdapter } from 'core/adapters/types';

const INSTANT = Symbol('weasel.setPoseInstant');

type PoseWrite<TPose> = (id: string, pose: TPose) => void;
type WithInstant<TPose> = { [INSTANT]?: PoseWrite<TPose> };

/** The member an adapter wrapper that animates `setPose` spreads into what it
 *  returns, so the write that does not animate survives any wrapper above it
 *  that copies the adapter. */
export function instantPoseWrite<TNode extends { id: string }, TPose>(
  inner: SceneAdapter<TNode, TPose>,
): object {
  return { [INSTANT]: (id: string, pose: TPose) => setPoseInstant(inner, id, pose) };
}

/** Write a pose at once, past every wrapper that would animate it. */
export function setPoseInstant<TNode extends { id: string }, TPose>(
  adapter: SceneAdapter<TNode, TPose>,
  id: string,
  pose: TPose,
): void {
  const instant = (adapter as WithInstant<TPose>)[INSTANT];
  if (instant) instant(id, pose);
  else adapter.setPose(id, pose);
}
