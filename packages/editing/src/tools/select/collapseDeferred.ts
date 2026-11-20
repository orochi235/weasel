import type { RefObject } from 'react';
import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import type { NodeId } from '@weasel-js/core';
import type { SelectModifiers } from '@weasel-js/select';
import type {} from '@weasel-js/core';

/** A click held back on the press: the id, and the modifiers the press was classified with. */
export interface DeferredClick {
  id: string;
  mods: SelectModifiers;
}

/**
 * `select.collapseDeferred` — the release half of the deferred multi-click.
 *
 * Pressing an already-selected node inside a multi-selection leaves the
 * selection alone so the press can start a drag of the whole set. If the
 * gesture ends without a drag, this collapses to the clicked node, with the
 * modifiers of the press: a key pressed or let go before release does not
 * turn the collapse into a toggle or a range the press never was.
 */
export function createCollapseDeferredAction(
  pressRef: RefObject<{ deferred: DeferredClick | null }>,
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
      pressRef.current.deferred !== null
        ? true
        : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const deferred = pressRef.current.deferred;
        pressRef.current = { deferred: null };
        if (deferred === null) return;
        const selection = deps.selection;
        if (!selection) return;
        selection.applyClick(deferred.id as NodeId, deferred.mods);
      },
    },
  });
}
