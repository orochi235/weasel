/**
 * The two halves of `useStandardActions`, apart from the action list it
 * defaults to, so a canvas that names its own set never loads the kit's.
 */
import { useEffect } from 'react';
import type { Action } from '@weasel-js/routing';
import { useActionsRegistry, useOptionalActiveToolContext, useOptionalDepRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { type DepName, type DepSchema } from '@weasel-js/routing';
// Reaches depSchema.ts so tsup's per-entry dts compiler resolves `DepSchema['selection']`
// here; `tsc --noEmit` happens to pick it up via test files, tsup does not. It MUST be
// `import type` — a bare `import './depSchema'` makes esbuild emit a runtime import that it
// then drops under the package's `sideEffects: false`, warning on every build.
import type {} from './depSchema';

/** The deps every standard action reads. */
export interface StandardDeps {
  /** Kit selection state — ids of currently selected nodes. */
  selection?: DepSchema['selection'];
  /** Current viewport — camera position + scale. */
  view?: DepSchema['view'];
  /** Scene tree — structural reads + undoable mutations. */
  scene?: DepSchema['scene'];
  /** Undo/redo history bound to the current scene. */
  history?: DepSchema['history'];
  /** Currently active tool id + hotkey-hold stack. */
  activeTool?: DepSchema['activeTool'];
}

/**
 * Publish each of `deps` as a live source in the nearest dep registry under
 * its canonical name; the source reads the latest value at invocation time.
 * `activeTool` falls back to the active-tool context. A no-op with no
 * registry in scope.
 */
export function useStandardDeps(deps: StandardDeps): void {
  const depsRef = useLatest(deps);
  const activeToolCtx = useOptionalActiveToolContext();
  const activeToolCtxRef = useLatest(activeToolCtx);
  const depReg = useOptionalDepRegistry();

  useEffect(() => {
    if (!depReg) return;
    const unregisters: Array<() => void> = [];
    const keys = ['selection', 'view', 'scene', 'history'] as const;
    for (const key of keys) {
      unregisters.push(
        depReg.register(key as DepName, () => depsRef.current[key] as DepSchema[DepName]),
      );
    }
    unregisters.push(
      depReg.register('activeTool' as DepName, () =>
        (depsRef.current.activeTool ?? activeToolCtxRef.current) as DepSchema[DepName],
      ),
    );
    return () => { for (const u of unregisters) u(); };
  }, [depReg, depsRef, activeToolCtxRef]);
}

/**
 * Kit-standard actions that stay unregistered while another one is
 * registered, because that one binds the same gesture and does everything
 * this one does: both answering it would act twice. Keyed by the action that
 * yields.
 */
const YIELDS_TO: Readonly<Record<string, string>> = {
  'clipboard.pasteEvent': 'ingest',
};

/**
 * Register `actions` into the nearest `<ActionsProvider>`, in order, leaving
 * out the ids in `exclude`; a no-op without both an actions and a dep
 * registry in scope. The set is keyed by its ids, so a fresh array of the same
 * actions does not re-register.
 */
export function useActionSet(actions: readonly Action[], exclude?: Iterable<string>): void {
  const reg = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const actionsRef = useLatest(actions);
  const excludeKey = exclude ? [...exclude].join('\u0000') : '';
  const actionsKey = actions.map((a) => a.id).join('\u0000');

  useEffect(() => {
    if (!reg || !depReg) return;
    const excluded = new Set(excludeKey ? excludeKey.split('\u0000') : []);
    const live = actionsRef.current.filter((a) => !excluded.has(a.id));
    const liveIds = new Set(live.map((a) => a.id));
    const unregisters = live
      .filter((a) => {
        const over = YIELDS_TO[a.id];
        return over === undefined || !liveIds.has(over);
      })
      .map((a) => reg.register(a));
    return () => { for (const u of unregisters) u(); };
  }, [reg, depReg, excludeKey, actionsKey, actionsRef]);
}
