/**
 * A text edit written through to the scene keystroke by keystroke, for a node
 * the canvas shows somewhere besides the overlay: text something derives
 * from, such as the hidden text a path effect lays along a path.
 */
import { sceneDependentsOf } from '../../core/scene/dependents';
import { asNodeId, type Scene } from '../../core/scene/types';
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

/** Where an edit's writes go. Each `draft` is written through, unrecorded, when something derives from the node; the
 *  `commit` records the result as one undo entry from the text before the first draft; `end` closes the edit, first
 *  putting back the data the drafts replaced when no commit came, so a canceled edit leaves no entry and the redo
 *  stack as it was. */
export function sceneTextDrafts<TData extends DefaultTextData, TLayer extends string, TPose>(
  sceneRef: { readonly current: Scene<TData, TLayer, TPose> },
  optsRef: { readonly current: UseSceneTextEditOptions<TData> },
): {
  draft: (id: string, draft: TextEditDraft) => void;
  commit: (id: string, data: TData) => void;
  end: (id: string) => void;
} {
  let from: { id: string; data: TData } | null = null;
  const draftWrite = (id: string, data: TData): void => {
    const scene = sceneRef.current;
    scene.untracked(() => scene.update(asNodeId(id), { data }));
  };
  /** Puts back what the drafts replaced, so the recorded change starts from there. */
  const restore = (id: string): void => {
    const held = from;
    from = null;
    if (held?.id === id && sceneRef.current.get(asNodeId(id))) draftWrite(id, held.data);
  };
  return {
    draft: (id, draft) => {
      const scene = sceneRef.current;
      const nid = asNodeId(id);
      const node = scene.get(nid);
      if (!node || sceneDependentsOf(scene, nid).length === 0) return;
      if (from?.id !== id) from = { id, data: node.data };
      draftWrite(id, editedData(node.data, draft, optsRef.current));
    },
    commit: (id, data) => {
      restore(id);
      const scene = sceneRef.current;
      scene.batch('Edit text', () => scene.update(asNodeId(id), { data }));
    },
    end: restore,
  };
}
