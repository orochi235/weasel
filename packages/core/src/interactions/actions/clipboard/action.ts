import { ActionDisabledReason, type Action } from '@weasel-js/routing';
import { commitDeleteToScene, deleteEnabled } from '../defaults/delete';
import type { NodeId } from 'core/scene/types';
import { requiresSelection } from '../defaults/requiresSelection';
import { kitWeaselJsonHandler } from 'domains/ingestion/weaselJsonHandler';
import { claimable, INGEST_REQUIRES, ingestFromEvent } from '../defaults/ingest';
import { ANY_MODS } from '@weasel-js/gestures';
import { icon } from '../../../icons.gen';
import type { ImmediateParams } from '@weasel-js/routing';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/**
 * Static descriptor for the `clipboard.copy` Action (Cmd/Ctrl+C).
 */
export const clipboardCopyAction: Action & { requires: string[] } = {
  id: 'clipboard.copy',
  label: 'Copy',
  icon: icon('copy'),
  group: 'clipboard',
  defaultBinding: [{ spec: { kind: 'key', key: 'c', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'clipboard.copy.key' } }],
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
 * Static descriptor for the `clipboard.cut` Action (Cmd/Ctrl+X) — copy, then
 * the same batched delete `deleteAction` performs, as one undo entry: the
 * sources a path effect hid go too.
 */
export const clipboardCutAction: Action & { requires: string[] } = {
  id: 'clipboard.cut',
  label: 'Cut',
  icon: icon('cut'),
  group: 'clipboard',
  defaultBinding: [{
    spec: { kind: 'key', key: 'x', mods: { mod: true }, phase: BETWEEN_GESTURES },
    opts: { id: 'clipboard.cut.key' },
  }],
  eligible: { capability: 'edits-page' },
  requires: ['clipboard', 'scene', 'selection', 'applyOps'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      if (!deps.clipboard || !deps.selection || !deps.scene) return;
      const ids = deps.selection.get() as readonly NodeId[];
      if (ids.length === 0 || deleteEnabled(deps) !== true) return;
      // Snapshot before removal — `snapshotSelection` reads live nodes.
      deps.clipboard.copy();
      commitDeleteToScene(ids, deps, 'Cut');
    },
  },
  enabled: deleteEnabled,
};

/**
 * Static descriptor for the `clipboard.paste` Action — what a Paste button or
 * menu item triggers, pasting the last copy this canvas made. It has no key
 * binding: Cmd/Ctrl+V already arrives as a DOM `paste` event, which the
 * dispatcher routes to `clipboard.pasteEvent` or `ingest`, and a binding here
 * would fire alongside it and paste twice.
 */
export const clipboardPasteAction: Action & { requires: string[] } = {
  id: 'clipboard.paste',
  label: 'Paste',
  icon: icon('paste'),
  group: 'clipboard',
  eligible: { capability: 'edits-page' },
  requires: ['clipboard'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const world = (params as ImmediateParams | undefined)?.world;
      deps.clipboard?.paste(world);
    },
  },
  enabled: (deps) => {
    const clipboard = deps?.clipboard;
    return clipboard && !clipboard.isEmpty() ? true : ActionDisabledReason.NotApplicable;
  },
};

const PASTE_EVENT_HANDLERS = [kitWeaselJsonHandler];

/**
 * Static descriptor for the `clipboard.pasteEvent` Action — Cmd/Ctrl+V on a
 * canvas that edits and does not ingest. It answers the DOM `paste` event by
 * pasting nodes a kit canvas copied to the OS clipboard, in this tab or
 * another, and nothing else: an image, SVG, or file on the clipboard, and
 * every consumer content handler, need `ingest`. `ingest` binds the same
 * event and takes this payload among the rest, so `useStandardActions`
 * leaves this one unregistered wherever `ingest` is registered.
 *
 * Bound to `text/plain` because that is the only flavor of a copy a paste
 * event carries; a paste without text stays the page's.
 */
export const clipboardPasteEventAction: Action & { requires: string[] } = {
  id: 'clipboard.pasteEvent',
  label: 'Paste copied nodes',
  defaultBinding: [{ spec: { kind: 'paste', types: ['text/plain'], mods: ANY_MODS }, opts: { id: 'clipboard.pasteEvent.paste' } }],
  requires: [...INGEST_REQUIRES],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => ingestFromEvent(deps, params, { handlers: PASTE_EVENT_HANDLERS }),
  },
  enabled: (_deps, _at, carried) => claimable(carried, PASTE_EVENT_HANDLERS),
};
