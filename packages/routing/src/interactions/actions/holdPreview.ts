/**
 * An action as a hold: bound to a held key, the press shows what it would do
 * through its `preview`, the release runs it, and a cancel — Escape, through
 * the kit's cancel-gesture action — takes the preview down and runs nothing.
 */
import type { Action } from './action';
import { resolveParams, type OngoingHandle } from './invoker';

/** The id {@link holdPreview} gives the hold of action `id`. */
export const holdPreviewId = (id: string): string => `${id}.hold`;

/**
 * `action` as a hold, under {@link holdPreviewId}. Bind it to a `held(…)` key,
 * in a keymap or anywhere else; the binding's params reach both the preview
 * and the run. It is enabled, eligible and requires what `action` does, so it
 * is skipped wherever `action` would be. An action with no `preview` shows
 * nothing and still runs on release; one whose invoker is not immediate is
 * not run.
 */
export function holdPreview(action: Action): Action {
  const { invoker } = action;
  return {
    id: holdPreviewId(action.id),
    label: action.label,
    ...(action.requires ? { requires: action.requires } : {}),
    ...(action.enabled ? { enabled: action.enabled } : {}),
    ...(action.eligible ? { eligible: action.eligible } : {}),
    invoker: {
      timing: 'ongoing',
      start: (ctx, opts): OngoingHandle => {
        const params = resolveParams(opts?.params);
        const hide = action.preview?.(ctx.deps, params);
        return {
          onEnd: (end, reason) => {
            hide?.();
            if (reason === 'commit' && invoker?.timing === 'immediate') invoker.run(end.deps, params);
          },
        };
      },
    },
  };
}
