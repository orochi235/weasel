import type { PrefAction, PrefLeaf } from '@weasel-js/prefs';
import type { ConfigActionContext } from '../config/types';

/** `leaf`, where it is an action with a `run`, with that run told the panel's config and writer too. */
export function boundAction<L extends PrefLeaf>(
  leaf: L,
  config: Record<string, unknown>,
  setConfig: (path: string, value: unknown) => void,
): L {
  if (leaf.kind !== 'action') return leaf;
  const run = (leaf as unknown as PrefAction).run as
    | ((ctx: ConfigActionContext) => void | Promise<void>)
    | undefined;
  if (!run) return leaf;
  return { ...leaf, run: (ctx: { path: string }) => run({ ...ctx, config, setConfig }) };
}
