/**
 * Editing a chart's text in place, through a canvas's own text editor: a text
 * mark whose datum names an `edit` is the spec's text, and closing the editor
 * folds what was typed into one edit of the spec.
 */
import { isTextData, useLatest, type NodeId, type RectPose, type Scene, type SceneCanvasTextEditor } from '@weasel-js/core';
import { useMemo } from 'react';
import type { PlotDatum } from '../marks/types';
import { textMeasure } from '../measure';
import { compilePlot } from '../plotData';
import { plotMarkOf, plotRootOf } from '../plotScene';
import type { PlotEdit } from './dragAction';
import { plotEditorOf } from './editors';

type AnyScene = Scene<unknown, string, unknown>;

/** The datum of a text mark an edit can set: one naming what it edits under `edit`, or `null` for any other node. */
export function plotTextOf(node: { data: unknown } | undefined): PlotDatum | null {
  const mark = plotMarkOf(node);
  return mark?.kind === 'text' && typeof mark.datum?.edit === 'string' ? mark.datum : null;
}

/** The text the spec gives mark `markId`, as compiled: what it showed before an edit. */
function compiledText(scene: AnyScene, rootId: string, markId: string): string | undefined {
  const root = scene.get(rootId as NodeId)!;
  const trait = plotRootOf(root)!;
  const { width, height } = root.pose as RectPose;
  const key = markId.slice(rootId.length + 1);
  return compilePlot(trait.data, { width, height }, trait.theme, textMeasure).find((m) => m.key === key)?.data.text;
}

/** Whether `data` is a chart's text an edit can set. */
export const isPlotText = (data: unknown): boolean => isTextData(data) && plotTextOf({ data }) !== null;

/**
 * Folds a text edit just written to one of a chart's text marks into its
 * root's spec: the edit is undone and `commit` gets the spec with the new
 * text, so the change is one entry on the spec, not a mark the next compile
 * would overwrite. Does nothing for any other node, or text that changes
 * nothing. Text that does not read (a value that is not a number) is undone,
 * so the mark shows the spec again.
 */
export function foldPlotText(scene: AnyScene, textId: string, commit: (edit: PlotEdit & { label: string }) => void): void {
  const node = scene.get(textId as NodeId);
  const datum = plotTextOf(node);
  const rootId = datum === null ? null : node!.parent;
  const trait = rootId === null ? null : plotRootOf(scene.get(rootId));
  const editor = trait === null ? null : plotEditorOf(trait.data);
  const text = (node?.data as { text?: unknown } | undefined)?.text;
  if (datum === null || trait === null || editor?.text === undefined || typeof text !== 'string') return;
  const next = editor.text(trait.data, datum, text);
  if (next === trait.data) {
    if (text !== compiledText(scene, rootId as string, textId)) scene.undo();
    return;
  }
  scene.undo();
  commit({ rootId: rootId as string, data: next, label: 'Edit text' });
}

/**
 * The `<SceneCanvas textEditor>` options that open on a chart's text and, as
 * the edit closes, fold it into one edit of the spec for `commit`.
 */
export function usePlotTextEdit(
  scene: AnyScene, commit: (edit: PlotEdit & { label: string }) => void,
): Exclude<SceneCanvasTextEditor<unknown>, false> {
  const latest = useLatest(commit);
  return useMemo(() => ({
    isText: isPlotText,
    onEnd: (id: string) => foldPlotText(scene, id, (edit) => latest.current(edit)),
  }), [scene, latest]);
}
