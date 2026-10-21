import { modeLabel, type ModeDefinition, type ModeRegistry } from '@weasel-js/modes';
import { ActionDisabledReason, type Action, type ActionDeps, type Contribution } from '@weasel-js/routing';

/** What a mode's double-click trigger does. */
export interface ModeTriggerHandlers {
  /** Enter mode `id` on the node `targetId`. Without it nothing is bound. */
  enter?: (id: string, targetId: string) => void;
  /**
   * Whether mode `id` can be entered on `targetId` now. Where it says no the double-click falls
   * through to the next binding on it, so a canvas action that already enters the mode on some
   * of those nodes keeps them: `enterPathEdit` on a path with anchors, say. Default yes.
   */
  canEnter?: (id: string, targetId: string) => boolean;
}

/**
 * The registry's double-click entries as an always-on contribution: for each mode whose
 * `entry.trigger` is `'double-click-target'`, one action bound to a double-click on each routing
 * kind its `entry.targets` names, entering the mode on the node double-clicked. Install it with
 * `<SceneCanvas ambient>`, beside `modeShortcuts`.
 *
 * The target is the node the dispatcher classified the double-click on (the `hitAt` dep's
 * `doubleClick`, else its hit), the one the binding's `kind:` target matched: a double-click on
 * a grouped member names its outermost group inside `<SceneCanvas isolatedGroup>`. The action is live in every mode, the target mode
 * included, so a double-click on another node moves a mode onto it; `canEnter` and `enter`
 * decide what a switch from the current mode means.
 *
 * The bindings ride the ambient tier: a tool that claims the double-click itself, the pen
 * finishing a stroke, keeps it.
 */
export function modeTriggers(registry: ModeRegistry, handlers: ModeTriggerHandlers): Contribution<never> {
  const actions: Action[] = [];
  const { enter } = handlers;
  if (enter) {
    for (const mode of registry.list()) {
      const targets = mode.entry?.trigger === 'double-click-target' ? mode.entry.targets ?? [] : [];
      if (targets.length > 0) actions.push(triggerAction(mode, targets, enter, handlers.canEnter));
    }
  }
  return { id: 'modes.triggers', eligibility: { always: true }, actions };
}

function triggerAction(
  mode: ModeDefinition,
  targets: readonly string[],
  enter: (id: string, targetId: string) => void,
  canEnter: ModeTriggerHandlers['canEnter'],
): Action {
  const targetAt = (deps: ActionDeps | undefined, at: { x: number; y: number } | undefined): string | null => {
    if (!at) return null;
    const hit = deps?.hitAt?.(at);
    const id = (hit?.doubleClick ?? hit)?.id;
    if (id === undefined) return null;
    return canEnter?.(mode.id, id) === false ? null : id;
  };
  const id = `mode.${mode.id}.trigger`;
  return {
    id,
    label: `Enter ${modeLabel(mode)}`,
    defaultBinding: targets.map((kind) => ({
      spec: { kind: 'doubleClick' as const, target: `kind:${kind}` as const },
      opts: { id: `${id}.doubleClick.${kind}` },
    })),
    requires: ['hitAt'],
    enabled: (deps, at) => (targetAt(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const x = params?.worldX, y = params?.worldY;
        const id = typeof x === 'number' && typeof y === 'number' ? targetAt(deps, { x, y }) : null;
        if (id !== null) enter(mode.id, id);
      },
    },
  };
}
