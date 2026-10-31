/**
 * Writing a sequence edit into a scene: the root's data replaced and its parts
 * built again, as one undo entry.
 */
import { composeWorldPose, scenePoseAdapter, type RectPose, type Scene } from '@weasel-js/core';
import type { MeasureRowText } from '../body';
import { diagramThemeOf } from '../theme/resolve';
import type { DiagramTheme } from '../theme/types';
import { setSequenceText } from './edit';
import { sequenceSpecs } from './specs';
import { sequencePartOf, sequenceRootOf } from './trait';
import type { SequenceData } from './types';

type AnyScene = Scene<unknown, string, unknown>;

/** How a scene's sequences are drawn when an edit builds their parts again. */
export interface SequenceDrawOptions {
  /** Measures text. Default an estimate from character count; pass what the sequence was first drawn with. */
  measure?: MeasureRowText;
  /** Default the scene's own `diagram:theme`. */
  theme?: DiagramTheme;
}

/** The world pose `id` stands at. */
const worldPose = (scene: AnyScene, id: string): RectPose =>
  composeWorldPose(scenePoseAdapter(scene as never), id, scene.composition.compose as never) as RectPose;

/** The parts of root `id` built from `data`, in the batch the caller has open. */
function rebuild(scene: AnyScene, id: string, data: SequenceData, opts: SequenceDrawOptions): void {
  const root = scene.get(id as never)!;
  const at = worldPose(scene, id);
  const [own, ...parts] = sequenceSpecs(data, {
    id, at, theme: opts.theme ?? diagramThemeOf(scene), layer: root.layer, composition: scene.composition as never,
    ...(opts.measure ? { measure: opts.measure } : {}),
  });
  scene.removeMany([...scene.childrenOf(id as never)]);
  const pose = root.pose as RectPose;
  scene.update(id as never, { data: own!.data });
  scene.setPose(id as never, { ...pose, width: own!.pose.width, height: own!.pose.height } as never);
  for (const part of parts) scene.add(part as never);
}

/** Replaces root `id`'s sequence with `data` and builds its parts again, as one undo entry under `label`. */
export function commitSequence(scene: AnyScene, id: string, data: SequenceData, label: string, opts: SequenceDrawOptions = {}): void {
  const node = scene.get(id as never);
  if (node === undefined || sequenceRootOf(node) === null) return;
  scene.batch(label, () => rebuild(scene, id, data, opts));
}

/** Builds every sequence in `scene` again from its own data, in the batch the caller has open: after a theme change. */
export function redrawSequences(scene: AnyScene, opts: SequenceDrawOptions = {}): void {
  for (const node of scene.renderOrderNodes()) {
    const root = sequenceRootOf(node);
    if (root !== null) rebuild(scene, node.id, root.sequence, opts);
  }
}

/** A sequence edit: root `id`'s new data. */
export interface SequenceEdit {
  id: string;
  data: SequenceData;
  /** What undo calls it. */
  label: string;
}

/**
 * Folds a text edit that has just been written to one of a sequence's text
 * parts into its root's data: the edit is undone and `commit` gets the
 * sequence with the new text, so the change is one entry on the data, not a
 * part that the next build would overwrite. Does nothing for any other node,
 * or text that did not change.
 */
export function foldSequenceText(scene: AnyScene, textId: string, commit: (edit: SequenceEdit) => void): void {
  const node = scene.get(textId as never);
  const part = node === undefined ? null : sequencePartOf(node);
  const root = part === null ? undefined : scene.get(part.root as never);
  const held = root === undefined ? null : sequenceRootOf(root);
  if (part === null || held === null || part.target === undefined) return;
  const text = (node!.data as { text?: unknown }).text;
  if (typeof text !== 'string') return;
  const next = setSequenceText(held.sequence, part.target, text);
  if (next === held.sequence) return;
  scene.undo();
  commit({ id: part.root, data: next, label: 'Edit text' });
}
