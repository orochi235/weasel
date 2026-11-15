import type { RefObject } from 'react';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type {} from '../../../interactions/actions/actionParamSchema';

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
  return defineAction({
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
      timing: 'immediate',
      run: (deps, params) => {
        const deferred = pressRef.current.deferredClickId;
        pressRef.current = { deferredClickId: null };
        if (deferred === null) return;
        const selection = deps.selection;
        if (!selection) return;
        selection.applyClick(
          deferred as NodeId,
          params?.mods ?? { alt: false, ctrl: false, meta: false, shift: false },
        );
      },
    },
  });
}
