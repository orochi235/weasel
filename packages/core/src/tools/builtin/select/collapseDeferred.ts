import type { RefObject } from 'react';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';

/**
 * `select.collapseDeferred` — the release half of the deferred multi-click.
 *
 * Pressing an already-selected node inside a multi-selection leaves the
 * selection alone so the press can start a drag of the whole set. If the
 * gesture ends without a drag, this collapses to the clicked node.
 */
export function createCollapseDeferredAction(
  pressRef: RefObject<{ deferredClickId: string | null }>,
): Action {
  return {
    id: 'select.collapseDeferred',
    label: 'Select — collapse deferred click',
    eligible: { capability: 'creates-selection' },
    requires: ['selection'],
    // Declining when there is nothing deferred is what keeps this binding
    // from swallowing every click on a node. It is bound at ACTIVE scope, so
    // without the gate it would outrank ambient click bindings like
    // `selectAnchor` and silently break anchor selection.
    enabled: () =>
      pressRef.current.deferredClickId !== null
        ? true
        : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const deferred = pressRef.current.deferredClickId;
        pressRef.current = { deferredClickId: null };
        if (deferred === null) return;
        const selection = deps.selection;
        if (!selection) return;
        const p = params as {
          mods?: { alt: boolean; ctrl: boolean; meta: boolean; shift: boolean };
        } | undefined;
        selection.applyClick(
          deferred as NodeId,
          p?.mods ?? { alt: false, ctrl: false, meta: false, shift: false },
        );
      },
    },
  };
}
