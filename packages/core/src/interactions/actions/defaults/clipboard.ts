import { createElement } from 'react';
import { CopyIcon, CutIcon, PasteIcon } from './icons/editIcons';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { buildDeleteOps } from './delete';
import { requiresSelection } from './requiresSelection';

/**
 * @experimental
 * Static descriptor for the `clipboard.copy` Action (Cmd/Ctrl+C).
 */
export const clipboardCopyAction: Action & { requires: string[] } = {
  id: 'clipboard.copy',
  label: 'Copy',
  icon: createElement(CopyIcon),
  group: 'clipboard',
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
      deps.clipboard?.copy();
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
  icon: createElement(CutIcon),
  group: 'clipboard',
  defaultBinding: { kind: 'key', key: 'x', mods: { mod: true } },
  eligible: { capability: 'edits-page' },
  requires: ['clipboard', 'scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const clipboard = deps.clipboard;
      const selection = deps.selection;
      const scene = deps.scene;
      const applyOps = deps.applyOps;
      if (!clipboard || !selection || !scene) return;
      const ids = selection.get();
      if (ids.length === 0) return;

      // Snapshot before removal — `snapshotSelection` reads live nodes.
      clipboard.copy();

      const ops = buildDeleteOps(scene, ids, 'Cut');
      if (ops.length > 0) {
        if (applyOps) applyOps(ops, 'Cut');
        else scene.applyBatch(ops, 'Cut', defaultCommitAdapter(scene, selection.adapterMethods));
      }
      selection.set([]);
    },
  },
  enabled: requiresSelection,
};

/**
 * @experimental
 * Static descriptor for the `clipboard.paste` Action — what a Paste button or
 * menu item triggers. It has no key binding: Cmd/Ctrl+V already arrives as a
 * DOM `paste` event, which the dispatcher routes to `ingest`, and a binding
 * here would fire alongside it and paste twice.
 */
export const clipboardPasteAction: Action & { requires: string[] } = {
  id: 'clipboard.paste',
  label: 'Paste',
  icon: createElement(PasteIcon),
  group: 'clipboard',
  eligible: { capability: 'edits-page' },
  requires: ['clipboard'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      deps.clipboard?.paste();
    },
  },
  enabled: (deps) => {
    const clipboard = deps?.clipboard;
    return clipboard && !clipboard.isEmpty() ? true : ActionDisabledReason.NotApplicable;
  },
};
