import { asNodeId, type UseSceneTextEditReturn, useSceneTextEdit } from '@weasel-js/core';
import { isCharacterChrome } from '@weasel-js/ui';
import { useEffect, useRef } from 'react';
import type { DrawScene } from './drawDocument';
import type { ModeMachine } from './modality';
import { useModeId } from './modality/useModeId';

/**
 * The text edit over the canvas, kept in step with the machine's `text-edit` mode. `host` is the
 * workspace element the contenteditable overlay mounts in; it may be null until the workspace
 * has mounted, which is before any edit can start.
 */
export function useTextEditSession(
  scene: DrawScene,
  host: HTMLElement | null,
  machine: ModeMachine,
): UseSceneTextEditReturn {
  const modeId = useModeId(machine);
  const textEdit = useSceneTextEdit(scene, host, {
    isEditorChrome: isCharacterChrome,
    // Escape out of a text edit keeps the text, as in every comparable
    // editor; losing a paragraph to a stray key is the worse failure.
    escape: 'commit',
  });

  // The session can end several ways — click-away commit, Escape, the node going away — and only
  // some of them run through the machine.
  //
  // Keyed on the session *ending* (a non-null id going null), not on "mode on, no session": the
  // machine and `startEdit` publish through different subscriptions, so there is a render in
  // between where the mode is live and the session isn't.
  const prevEditingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevEditingIdRef.current;
    prevEditingIdRef.current = textEdit.editingId;
    if (prev == null || textEdit.editingId != null) return;
    if (modeId === 'text-edit') machine.exitMode();

    // An edit that ends with no text leaves a node that paints nothing and still picks, so
    // discard it — as a history entry, so it's undoable.
    const nid = asNodeId(prev);
    const node = scene.get(nid);
    if (node && node.kind === 'leaf') {
      const data = node.data;
      const isTextNode = data.text !== undefined;
      const hasRuns = Array.isArray(data.runs) && data.runs.length > 0;
      if (isTextNode && data.text === '' && !hasRuns) {
        scene.batch('Discard empty text', () => { scene.remove(nid); });
      }
    }
  }, [modeId, textEdit.editingId, machine, scene]);

  // The mode can also end while the editor is still mounted (the breadcrumb's exit), which would
  // leave it over the canvas swallowing keystrokes. Commit it, as Escape does.
  const prevModeIdRef = useRef<string>(modeId);
  useEffect(() => {
    const prev = prevModeIdRef.current;
    prevModeIdRef.current = modeId;
    if (prev === 'text-edit' && modeId !== 'text-edit' && textEdit.editingId != null) {
      textEdit.commit();
    }
  }, [modeId, textEdit]);

  return textEdit;
}
