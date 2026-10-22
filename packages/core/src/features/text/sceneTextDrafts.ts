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

/** Where an edit's drafts go: `write` each one through when something derives from the node, `settle` once the edit
 *  commits, and `restore` as it ends — which puts back the data the first draft replaced unless a commit settled it. */
export function sceneTextDrafts<TData extends DefaultTextData, TLayer extends string, TPose>(
  sceneRef: { readonly current: Scene<TData, TLayer, TPose> },
  optsRef: { readonly current: UseSceneTextEditOptions<TData> },
): { write: (id: string, draft: TextEditDraft) => void; settle: () => void; restore: (id: string) => void } {
  let from: { id: string; data: TData } | null = null;
  return {
    write: (id, draft) => {
      const scene = sceneRef.current;
      const nid = asNodeId(id);
      const node = scene.get(nid);
      if (!node || sceneDependentsOf(scene, nid).length === 0) return;
      if (from?.id !== id) from = { id, data: node.data };
      scene.update(nid, { data: editedData(node.data, draft, optsRef.current) });
    },
    settle: () => { from = null; },
    restore: (id) => {
      const held = from;
      from = null;
      if (held?.id === id && sceneRef.current.get(asNodeId(id))) sceneRef.current.update(asNodeId(id), { data: held.data });
    },
  };
}
