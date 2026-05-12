/**
 * @experimental
 * `useStandardActions` — register the standard 5-default action set
 * (`selectAll` / `escape` / `duplicate` / 8× `nudge` / 2× `reorder`) into
 * the nearest `<ActionsProvider>`. The same logic `<SceneCanvas>` uses
 * internally; this hook is for bare-`<Canvas>` consumers who want the same
 * keystroke defaults without restructuring to `<SceneCanvas>`.
 *
 * Resolution rules: see
 * `docs/superpowers/specs/2026-05-09-actions-registry-design.md` §D.
 *
 * Falls back silently to a no-op when no `<ActionsProvider>` is in scope.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { Action, ActionsProp } from './registry';
import { useActionsRegistry } from './registry';
import {
  resolveActions,
  type StandardActionDefaults,
  type StandardActionsDeps,
} from './resolveActions';

export type {
  StandardActionsDeps,
  StandardActionDefaults,
} from './resolveActions';

export interface UseStandardActionsOptions<TPose> {
  actions?: ActionsProp;
  defaults?: StandardActionDefaults<TPose>;
}

/**
 * @experimental
 * Register the standard default actions into the surrounding
 * `<ActionsProvider>`. Stabilizes deps via refs so consumers don't have to
 * memoize them — the resolver re-runs only when `options.actions` /
 * `options.defaults` identity changes.
 *
 * No-op when no `<ActionsProvider>` is in scope.
 */
export function useStandardActions<TPose>(
  deps: StandardActionsDeps<TPose>,
  options?: UseStandardActionsOptions<TPose>,
): void {
  const reg = useActionsRegistry();

  // Stabilize deps via refs — consumers commonly recreate closures every
  // render (selection getters, etc.) and we don't want to re-resolve actions
  // 60×/sec. The resolved Action descriptors close over a single set of
  // delegating callbacks that read the latest `depsRef.current` at call time.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const stableDeps = useMemo<StandardActionsDeps<TPose>>(() => ({
    getSelection: () => depsRef.current.getSelection(),
    setSelection: (ids) => depsRef.current.setSelection(ids),
    listAll: () => depsRef.current.listAll(),
    getPose: (id) => depsRef.current.getPose(id),
    applyOps: (ops, label) => depsRef.current.applyOps(ops, label),
    translatePose: (pose, dx, dy) => depsRef.current.translatePose(pose, dx, dy),
  }), []);

  const actionsProp = options?.actions;
  const defaultsProp = options?.defaults;

  const resolved = useMemo<Action[]>(
    () => resolveActions<TPose>(stableDeps, {
      ...(actionsProp !== undefined ? { actions: actionsProp } : {}),
      ...(defaultsProp !== undefined ? { defaults: defaultsProp } : {}),
    }),
    [stableDeps, actionsProp, defaultsProp],
  );

  useEffect(() => {
    if (!reg) return;
    const unregisters = resolved.map((a) => reg.register(a));
    return () => {
      for (const u of unregisters) u();
    };
  }, [reg, resolved]);
}
