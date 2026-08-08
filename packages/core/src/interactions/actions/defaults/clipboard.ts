import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import type { Action } from '../registry';
import { buildDeleteOps } from './delete';
import { requiresSelection } from './requiresSelection';

/**
 * Clipboard dep — the imperative surface `useClipboardOps` returns.
 *
 * Consumers publish their live clipboard through `useDepSource('clipboard',
 * …)` from inside the `<DepRegistryProvider>` (i.e. under `<SceneCanvas>`).
 * The kit deliberately does not build one for them: `useClipboardOps` needs
 * an adapter and a selection reader that only the consumer can supply.
 */
export interface ClipboardDep {
  copy(): void;
  paste(): void;
  isEmpty(): boolean;
}

/**
 * @experimental
 * Static descriptor for the `clipboard.copy` Action (Cmd/Ctrl+C).
 */
export const clipboardCopyAction: Action & { requires: string[] } = {
  id: 'clipboard.copy',
  label: 'Copy',
  defaultBinding: { kind: 'key', key: 'c', mods: { mod: true } },
  // Same gate as `duplicate`: a mode that can neither edit the page nor own a
  // selection has nothing to copy. Notably excludes `text-edit`, where Cmd+C
  // must stay the browser's own copy of the caret range.
  eligible: { capability: ['edits-page', 'creates-selection'] },
  // `selection` is read by the `enabled` gate, not the invoker — the
  // dispatcher builds deps for both, and an undeclared read is undefined.
  requires: ['clipboard', 'selection'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      (deps.clipboard as ClipboardDep | undefined)?.copy();
    },
  },
  enabled: requiresSelection,
};

/**
 * @experimental
 * Static descriptor for the `clipboard.cut` Action (Cmd/Ctrl+X) — copy, then
 * the same batched delete `deleteAction` performs, as one undo entry.
 */
export const clipboardCutAction: Action & { requires: string[] } = {
  id: 'clipboard.cut',
  label: 'Cut',
  defaultBinding: { kind: 'key', key: 'x', mods: { mod: true } },
  eligible: { capability: 'edits-page' },
  requires: ['clipboard', 'scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const clipboard = deps.clipboard as ClipboardDep | undefined;
      const selection = deps.selection as SelectionApi | undefined;
      const scene = deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = deps.applyOps as ((ops: Op[], label: string) => void) | undefined;
      if (!clipboard || !selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;

      // Snapshot before removal — `snapshotSelection` reads live nodes.
      clipboard.copy();

      const ops = buildDeleteOps(scene, ids, 'Cut');
      if (ops.length > 0) {
        if (applyOps) applyOps(ops, 'Cut');
        else scene.applyBatch(ops, 'Cut', defaultCommitAdapter(scene));
      }
      selection.set([]);
    },
  },
  enabled: requiresSelection,
};

// There is deliberately no `clipboard.paste` descriptor. Cmd/Ctrl+V already
// arrives as a DOM `paste` event, which the dispatcher routes to the `ingest`
// action and the content-handler registry — the path that reaches the OS
// payload. A key binding would fire alongside it and paste twice.
