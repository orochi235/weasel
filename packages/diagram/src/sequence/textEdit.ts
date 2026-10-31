/** Editing a sequence's text in place, through a canvas's own text editor. */
import { isTextData, useLatest, type Scene, type SceneCanvasTextEditor } from '@weasel-js/core';
import type { DiagramSceneData } from '../dataTypes';
import { useMemo } from 'react';
import { foldSequenceText, type SequenceEdit } from './commit';
import { sequencePartOf } from './trait';

/** Whether `data` is a sequence's text an edit can set: a head's, a message's or note's, a section's, a box's. */
export const isSequenceText = (data: unknown): boolean => isTextData(data) && sequencePartOf({ data })?.target !== undefined;

/**
 * The `<SceneCanvas textEditor>` options that open on a sequence's text and,
 * as the edit closes, fold it into one edit of the sequence's data for
 * `report`. `undefined` while `report` is.
 */
export function useSequenceTextEdit(
  scene: Scene<unknown, string, unknown>, report: ((edit: SequenceEdit) => void) | undefined,
): Exclude<SceneCanvasTextEditor<DiagramSceneData>, false> | undefined {
  const latest = useLatest(report);
  const on = report !== undefined;
  return useMemo(() => (on
    ? {
        isText: isSequenceText,
        onEnd: (id: string) => foldSequenceText(scene, id, (edit) => latest.current?.(edit)),
      }
    : undefined), [on, scene, latest]);
}
