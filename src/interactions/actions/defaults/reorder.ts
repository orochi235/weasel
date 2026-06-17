import { createReorderOp } from 'core/ops/reorder';
import type { Scene } from 'core/scene/types';
import type { Op } from 'core/ops/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import type { Action } from '../registry';
import { requiresSelection } from './requiresSelection';

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

type ReorderDistance = 'adjacent' | 'extreme';

/**
 * Execute a directional reorder on the current selection. Translates
 * `direction` + `distance` into the four-way `ReorderDirection` understood by
 * `createReorderOp`, then routes the single reorder op through the consumer
 * `applyOps` commit hook (consumer history) when present, falling back to
 * `scene.applyBatch` against the shared `defaultCommitAdapter`. Either way the
 * whole reorder lands as one undo entry labelled `'Reorder'`.
 */
function reorderSelection(
  selection: SelectionApi,
  scene: Scene<unknown, string, unknown>,
  direction: 'forward' | 'backward',
  distance: ReorderDistance,
  applyOps: ((ops: Op[], label: string) => void) | undefined,
): void {
  const ids = selection.get() as string[];
  if (ids.length === 0) return;

  const reorderDir =
    direction === 'forward'
      ? distance === 'extreme' ? 'front' : 'forward'
      : distance === 'extreme' ? 'back' : 'backward';

  // `createReorderOp` partitions `ids` by their current parent and rewrites
  // each affected parent's child order via the adapter's `getChildren` /
  // `setChildOrder` (and `getParent`) — all carried by `defaultCommitAdapter`.
  const op = createReorderOp({ ids, direction: reorderDir, label: 'Reorder' });

  if (applyOps) applyOps([op], 'Reorder');
  else scene.applyBatch([op], 'Reorder', defaultCommitAdapter(scene));
}

// ---------------------------------------------------------------------------
// Descriptors
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Parametric descriptor for forward reorder (`reorder.forward`).
 *
 * Collapses the old `reorder.forward` (adjacent) and `reorder.front`
 * (extreme) actions into one descriptor with two keybindings. The distance
 * param (`'adjacent'` | `'extreme'`) is carried in `opts.params.distance`
 * and forwarded to `invoker.run` by the dispatcher.
 */
export const reorderForwardAction: Action & { requires: string[] } = {
  id: 'reorder.forward',
  label: 'Bring Forward',
  group: 'reorder',
  defaultBinding: [
    {
      spec: { kind: 'key', key: [']', '}'], mods: { mod: true } },
      opts: { params: { distance: 'adjacent' } },
    },
    {
      // Cmd+Alt+] → bring-to-front. NOT Cmd+Shift+] — Chrome on macOS reserves
      // Cmd+Shift+[ / Cmd+Shift+] for tab switching and never delivers them to
      // the page. On macOS Option+] emits the character '‘' (U+2018); whether
      // Cmd suppresses that transform is browser-dependent, so we match both the
      // bracket and the Option-produced char (US layout). matchKey is
      // character-based, so non-US layouts may need a rebind.
      spec: { kind: 'key', key: [']', '‘'], mods: { mod: true, alt: true } },
      opts: { params: { distance: 'extreme' } },
    },
  ],
  eligible: { capability: 'edits-page' },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const distance = (params?.distance as ReorderDistance | undefined) ?? 'adjacent';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!selection || !scene) return;
      reorderSelection(selection, scene, 'forward', distance, applyOps);
    },
  },
  enabled: requiresSelection,
};

/**
 * @experimental
 * Parametric descriptor for backward reorder (`reorder.backward`).
 *
 * Collapses the old `reorder.backward` (adjacent) and `reorder.back`
 * (extreme) actions into one descriptor with two keybindings.
 */
export const reorderBackwardAction: Action & { requires: string[] } = {
  id: 'reorder.backward',
  label: 'Send Backward',
  group: 'reorder',
  defaultBinding: [
    {
      spec: { kind: 'key', key: ['[', '{'], mods: { mod: true } },
      opts: { params: { distance: 'adjacent' } },
    },
    {
      // Cmd+Alt+[ → send-to-back. See the bring-to-front note above: avoids
      // Chrome's reserved Cmd+Shift+[ tab-switch shortcut. On macOS Option+[
      // emits '“' (U+201C), included alongside the bracket for robustness.
      spec: { kind: 'key', key: ['[', '“'], mods: { mod: true, alt: true } },
      opts: { params: { distance: 'extreme' } },
    },
  ],
  eligible: { capability: 'edits-page' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const distance = (params?.distance as ReorderDistance | undefined) ?? 'adjacent';
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!selection || !scene) return;
      reorderSelection(selection, scene, 'backward', distance, applyOps);
    },
  },
  enabled: requiresSelection,
};

