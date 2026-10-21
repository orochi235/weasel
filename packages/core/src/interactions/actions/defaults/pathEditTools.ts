/**
 * Path edit's tools: a set of named tools, one active at a time, each
 * changing what a plain drag in path edit does (the `editAnchors` dep's `tool`).
 * With none active a drag edits anchors as usual. These actions switch them:
 * one toggle per tool for a bar, and Escape to go back to anchor editing.
 */

import type { Action, ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';

const depOf = (deps: ActionDeps | undefined): EditAnchorsDep | null =>
  (deps?.editAnchors?.editingId ? deps.editAnchors : null);

/** Whether a path-edit tool is active, so plain anchor editing should yield. */
export function pathEditToolActive(deps: ActionDeps | undefined): boolean {
  return (depOf(deps)?.tool ?? null) !== null;
}

/** A toolbar toggle for path-edit tool `tool`: on, a plain drag is that
 *  tool's; pressed again, anchor editing comes back. Its id is
 *  `pathEditTool.<tool>`. */
export function pathEditToolAction(
  tool: string,
  label: string,
  icon?: Action['icon'],
): Action & { requires: string[] } {
  return {
    id: `pathEditTool.${tool}`,
    label,
    ...(icon ? { icon } : {}),
    group: 'anchors',
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const dep = depOf(deps);
        if (dep) dep.setTool(dep.tool === tool ? null : tool);
      },
    } as ImmediateInvoker,
    active: (deps) => depOf(deps)?.tool === tool,
    enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.SelectionRequired),
  };
}

/** Escape with a path-edit tool on puts it down; a second Escape then leaves
 *  path edit. The phase makes it outrank `exitPathEdit`'s bare Escape, and it
 *  is disabled with no tool on, so it takes the first press only; mid-drag,
 *  Escape is `cancelGesture`'s. */
export const exitPathEditToolAction: Action & { requires: string[] } = {
  id: 'pathEditTool.exit',
  label: 'Put down path-edit tool',
  defaultBinding: [{ spec: { kind: 'key', key: 'Escape', phase: [{ channel: '*', phase: 'initial' }] }, opts: { id: 'pathEditTool.exit.key' } }],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => depOf(deps)?.setTool(null),
  } as ImmediateInvoker,
  enabled: (deps) => (pathEditToolActive(deps) ? true : ActionDisabledReason.NotApplicable),
};
