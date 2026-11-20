/**
 * An action as a hold: bound to a held key, the press shows what it would do
 * through its `preview`, the release runs it if `enabled` still allows, and a cancel — Escape, through
 * the kit's cancel-gesture action — takes the preview down and runs nothing.
 */
import type { Action } from './action';
import { checkEnabled } from './actionEnabled';
import { resolveParams, type OngoingHandle } from './invoker';
import { dynamicActionId, type DynamicActionId } from './actionIds';
import { showPreview } from './showPreview';

/** The id {@link holdPreview} gives the hold of action `id`. Its params are the action's, which the schema does
 *  not name under this id, so it is a dynamic one. */
export const holdPreviewId = (id: string): DynamicActionId => dynamicActionId(`${id}.hold`);

const HOLDS = Symbol('weasel.holdOf');

type Hold = Action & { [HOLDS]?: string };

/**
 * `action` as a hold, under {@link holdPreviewId}. Bind it to a `held(…)` key,
 * in a keymap or anywhere else; the binding's params reach both the preview
 * and the run. It is enabled, eligible and requires what `action` does, so it
 * is skipped wherever `action` would be. An action with no `preview` shows
 * nothing and still runs on release; one whose invoker is not immediate is
 * not run.
 *
 * Registered in an actions registry, the hold follows whatever that registry
 * resolves for `action.id`: its replacement, tunings and session params, and
 * a mute, which mutes the hold too.
 */
export function holdPreview(action: Action): Action {
  const hold: Hold = { id: holdPreviewId(action.id), label: action.label, ...holding(action), [HOLDS]: action.id };
  return hold;
}

/** @internal The id of the action `a` holds, when {@link holdPreview} made it. */
export function heldActionId(a: Action): string | undefined {
  return (a as Hold)[HOLDS];
}

/** @internal `hold` holding `action`, the live descriptor for its id, in place of the one it was made from. */
export function holdingLive(hold: Action, action: Action): Action {
  const { requires: _r, enabled: _e, eligible: _g, invoker: _i, ...rest } = hold;
  return { ...rest, ...holding(action) };
}

/** What a hold of `action` takes from it: its gates, and an invoker running it. */
function holding(action: Action): Pick<Action, 'requires' | 'enabled' | 'eligible' | 'invoker'> {
  const { invoker } = action;
  return {
    ...(action.requires ? { requires: action.requires } : {}),
    ...(action.enabled ? { enabled: action.enabled } : {}),
    ...(action.eligible ? { eligible: action.eligible } : {}),
    invoker: {
      timing: 'ongoing',
      start: (ctx, opts): OngoingHandle => {
        const params = resolveParams(opts?.params);
        const hide = showPreview(action, () => ctx.deps, params, ctx.world);
        return {
          // An end's ctx carries no deps, so the run takes the press's.
          onEnd: (_end, reason) => {
            hide();
            if (reason !== 'commit' || invoker?.timing !== 'immediate') return;
            // Asked again: what the press previewed may have stopped applying while the key was held.
            if (checkEnabled(action, ctx.deps, ctx.world, params).enabled) invoker.run(ctx.deps, params);
          },
        };
      },
    },
  };
}
