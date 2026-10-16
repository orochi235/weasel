/**
 * What the anchor-command labs share: a bar of controls over the canvas, and
 * opening steps run through the kit's own actions.
 */
import { useActionsRegistry } from '@weasel-js/core';
import { type ReactNode, useEffect } from 'react';
import s from './pathLab.module.css';

/**
 * Run `steps` once the canvas has registered its actions — the kit's own
 * actions, triggered as a key press would. Mount it after the canvas, so the
 * canvas's effects have run.
 */
export function OpeningSteps({ steps }: { steps: ReadonlyArray<readonly [string, Record<string, unknown>?]> }) {
  const actions = useActionsRegistry();
  useEffect(() => {
    if (!actions) return;
    for (const [id, params] of steps) actions.trigger(id, params);
    // Once, on mount: the steps are the lab's opening state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);
  return null;
}

/** The trial's canvas with a bar of controls over its top-left corner, inside
 *  the trial because the canvas registers the actions the bar draws. */
export function PathLabStage({ bar, children }: { bar: ReactNode; children: ReactNode }) {
  return (
    <div className={s.stage}>
      {children}
      <div className={s.bar}>{bar}</div>
    </div>
  );
}
