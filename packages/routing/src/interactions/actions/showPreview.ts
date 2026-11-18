/**
 * Running an action's `preview`, for `ActionsRegistry.preview` and `holdPreview`: asked only while `enabled` allows it, and handing
 * back a take-down that is safe to call twice.
 */
import type { Action } from './action';
import { checkEnabled } from './actionEnabled';
import type { ActionDeps, WorldPoint } from './invoker';

const NO_PREVIEW = (): void => {};

/** What `action`'s preview shows when run with `params` at `at`, and what takes it down: nothing for an action
 *  with no preview, one whose `enabled` refuses, and one whose preview throws or returns nothing. */
export function showPreview(
  action: Action | undefined,
  depsOf: (action: Action) => ActionDeps,
  params: Record<string, unknown> | undefined,
  at: WorldPoint | undefined,
): () => void {
  if (!action?.preview) return NO_PREVIEW;
  const bag = depsOf(action);
  if (!checkEnabled(action, bag, at, params).enabled) return NO_PREVIEW;
  let stop: (() => void) | void;
  try {
    stop = action.preview(bag, params);
  } catch (err) {
    console.error(`weasel ActionsRegistry: preview of "${action.id}" threw`, err);
    return NO_PREVIEW;
  }
  if (typeof stop !== 'function') return NO_PREVIEW;
  let down = false;
  return () => {
    if (down) return;
    down = true;
    try {
      stop();
    } catch (err) {
      console.error(`weasel ActionsRegistry: preview of "${action.id}" threw as it ended`, err);
    }
  };
}
