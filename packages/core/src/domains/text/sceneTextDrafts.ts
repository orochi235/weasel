/**
 * A text edit shown to the scene keystroke by keystroke, for the readers that
 * see a node somewhere besides the overlay: text something derives from, such
 * as the hidden text a path effect lays along a path, or a second view.
 */
import { asNodeId, type PoseHold, type Scene } from '../../core/scene/types';
import type { StyledRun, TextStyle } from '@weasel-js/text';
import type { TextEditDraft } from '@weasel-js/text-dom';
import type { DefaultTextData, UseSceneTextEditOptions } from './useSceneTextEdit';

/** `data` with an edit's text, runs and style folded in through the options' setters, for one `scene.update`. */
export function editedData<TData extends DefaultTextData>(
  data: TData,
  edit: { text: string; runs?: readonly StyledRun[]; style?: TextStyle },
  { setText, setRuns, setStyle }: UseSceneTextEditOptions<TData>,
): TData {
  let next = setText ? setText(data, edit.text) : { ...data, text: edit.text };
  if (edit.runs) next = setRuns ? setRuns(next, [...edit.runs]) : { ...next, runs: edit.runs };
  if (edit.style) next = setStyle ? setStyle(next, edit.style) : { ...next, style: edit.style };
  return next;
}

/** Where an edit's writes go. Each `draft` is shown as a data override folding the draft into whatever the node stores,
 *  so a recorded write made meanwhile shows through it and the document holds no draft; the `commit` records the
 *  result as one undo entry and then lets the override go; `end` lets it go, so a canceled edit leaves no entry and
 *  the redo stack as it was. */
export function sceneTextDrafts<TData extends DefaultTextData, TLayer extends string, TPose>(
  sceneRef: { readonly current: Scene<TData, TLayer, TPose> },
  optsRef: { readonly current: UseSceneTextEditOptions<TData> },
): {
  draft: (id: string, draft: TextEditDraft) => void;
  commit: (id: string, data: TData) => void;
  end: (id: string) => void;
  /** Let any open edit's draft go, as an unmount must: the overlay goes without an `end`. */
  close: () => void;
} {
  /** The open edit's claim on the scene's overrides, with the scene it was made on. */
  let held: { id: string; scene: Scene<TData, TLayer, TPose>; hold: PoseHold<TPose, TData> } | null = null;
  const release = (id: string): void => {
    if (held?.id !== id) return;
    held.hold.drop();
    held = null;
  };
  return {
    draft: (id, draft) => {
      const scene = sceneRef.current;
      if (scene.get(asNodeId(id)) === undefined) return;
      if (held !== null && (held.id !== id || held.scene !== scene)) release(held.id);
      held ??= { id, scene, hold: scene.overrides.hold() };
      const opts = optsRef.current;
      held.hold.show([[asNodeId(id), { data: (stored) => editedData(stored, draft, opts) }]]);
    },
    commit: (id, data) => {
      const scene = sceneRef.current;
      scene.batch('Edit text', () => scene.update(asNodeId(id), { data }));
      // After the write, so no frame shows the text from before the edit in between.
      release(id);
    },
    end: release,
    close: () => {
      if (held !== null) release(held.id);
    },
  };
}
