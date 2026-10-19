import { asNodeId, type UseSceneTextEditReturn, useLatest, useSceneTextEdit } from '@weasel-js/core';
import { isCharacterChrome } from '@weasel-js/ui/components/CharacterOptions';
import { useEffect, useRef } from 'react';
import type { DrawScene } from './drawDocument';
import type { ModeMachine } from './modality';
import { enterModeOn } from './modality/enterModeOn';

const TEXT_EDIT = 'text-edit';

/** An edit that ends with no text leaves a node that paints nothing and still picks, so it is
 *  removed, as a history entry of its own. */
function discardIfEmpty(scene: DrawScene, id: string): void {
  const nid = asNodeId(id);
  const node = scene.get(nid);
  if (!node || node.kind !== 'leaf') return;
  const { text, runs } = node.data;
  if (text !== '' || (Array.isArray(runs) && runs.length > 0)) return;
  scene.batch('Discard empty text', () => { scene.remove(nid); });
}

const inModeOn = (machine: ModeMachine, id: string): boolean =>
  machine.registry.current().id === TEXT_EDIT && machine.getActiveTargetId() === id;

/**
 * The text edit over the canvas. The edit is the owner of "is a text edit open": the machine's
 * `text-edit` mode is entered as an edit opens and left as it closes, whatever opened or closed
 * it. `host` is the workspace element the contenteditable overlay mounts in; it may be null
 * until the workspace has mounted, which is before any edit can start.
 */
export function useTextEditSession(
  scene: DrawScene,
  host: HTMLElement | null,
  machine: ModeMachine,
): UseSceneTextEditReturn {
  /** The node the open edit is on, as the edit last reported it. */
  const open = useRef<string | null>(null);

  const textEdit = useSceneTextEdit(scene, host, {
    isEditorChrome: isCharacterChrome,
    // Escape out of a text edit keeps the text, as in every comparable
    // editor; losing a paragraph to a stray key is the worse failure.
    escape: 'commit',
    onStart: (id) => {
      // Entering can leave another mode first, and nothing is open on this node until it has.
      enterModeOn(machine, TEXT_EDIT, id);
      open.current = id;
    },
    onEnd: (id) => {
      open.current = null;
      if (inModeOn(machine, id)) machine.exitMode();
      discardIfEmpty(scene, id);
    },
  });

  // The one end the edit does not decide: the mode left under it (the breadcrumb's exit), which
  // would leave the editor over the canvas swallowing keystrokes. Commit it, as Escape does.
  const edit = useLatest(textEdit);
  useEffect(() => machine.registry.subscribe(() => {
    if (open.current !== null && !inModeOn(machine, open.current)) edit.current.commit();
  }), [machine, edit]);

  return textEdit;
}
