import { describe, expect, it } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createScene } from 'core/scene/scene';
import { asNodeId, type RectPose } from 'core/scene/types';
import { deleteAction } from './delete';
import { duplicateAction } from './duplicate';
import { clipboardCutAction } from '../clipboard/action';

function pageOnly() {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const page = scene.add({ kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 }, page: {} } as never) as string;
  let current = [asNodeId(page)];
  const selection = { get: () => current, set: (next: typeof current) => { current = [...next]; } };
  return { deps: { scene, selection } as never };
}

describe('an edit action over a selection of pages alone', () => {
  for (const action of [deleteAction, clipboardCutAction, duplicateAction]) {
    it(`${action.id} is disabled`, () => {
      expect(action.enabled!(pageOnly().deps)).toBe(ActionDisabledReason.SelectionRequired);
    });
  }
});
