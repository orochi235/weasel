import { useLatest } from '@weasel-js/core';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

/** What {@link useTrialConfigChange} runs: the trial's config after a write, and before it, auto values resolved. */
export type TrialConfigChangeHandler<TC = unknown> = (config: TC, prev: TC) => void;

/** Reports a handler mounted; the returned function reports it gone. */
export type MountTrialConfigChange = (handler: TrialConfigChangeHandler) => () => void;

/** The config-change slot of the trial around the caller; `null` outside one. */
export const TrialConfigChangeContext = createContext<MountTrialConfigChange | null>(null);

/**
 * Runs `handler` inside every write of the trial's settings — the panel, chrome, `ctx.setConfig` — once the
 * value has landed and before anything renders. What it writes onto the history the instrument handed over with
 * `useTrialHistory` joins the undo entry the write records, so a setting that drives the instrument's own data,
 * a style written onto a scene's selected strokes say, is one undo step with the panel, and a slider's drag is
 * one step. Undo, redo, Reset and a record loaded do not run it: they carry that data with the settings already.
 */
export function useTrialConfigChange<TC>(handler: TrialConfigChangeHandler<TC>): void {
  const mount = useContext(TrialConfigChangeContext);
  const latest = useLatest(handler);
  useEffect(
    () => mount?.((config, prev) => latest.current(config as TC, prev as TC)),
    [mount, latest],
  );
}

/** The trial's side of {@link useTrialConfigChange}: the slot to provide, and the handlers mounted in it now. */
export function useTrialConfigChanges(): {
  mount: MountTrialConfigChange;
  handlers: () => readonly TrialConfigChangeHandler[];
} {
  const live = useRef<readonly TrialConfigChangeHandler[]>([]);
  const mount = useCallback<MountTrialConfigChange>((handler) => {
    live.current = [...live.current, handler];
    return () => {
      live.current = live.current.filter((h) => h !== handler);
    };
  }, []);
  const handlers = useCallback(() => live.current, []);
  return { mount, handlers };
}
