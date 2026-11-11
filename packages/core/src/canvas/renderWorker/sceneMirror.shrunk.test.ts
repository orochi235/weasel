/** Counterexamples `sceneMirror.pbt.test.ts` shrank to, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { createScene } from 'core/scene/scene';
import { asNodeId as id, type RectPose, type Scene } from 'core/scene/types';
import { createSceneDiff } from './sceneDiff';
import { createSceneMirror } from './sceneMirror';

type AnyScene = Scene<unknown, string, unknown>;
const box = { x: 0, y: 0, width: 1, height: 1 };

describe('the render worker scene copy', () => {
  it('keeps a member on its own layer when its group goes back down under it', () => {
    const page = createScene<unknown, string, RectPose>({ systemLayers: [{ id: 'main' }, { id: 'top' }] }) as unknown as AnyScene;
    const diff = createSceneDiff(), mirror = createSceneMirror();
    const sync = () => {
      const delta = diff.next(page);
      if (delta) mirror.apply(structuredClone(delta));
    };
    sync();
    page.add({ id: id('g'), kind: 'group', layer: 'main', pose: box, data: null } as never);
    page.add({ id: id('m'), kind: 'group', layer: 'top', pose: box, data: null, parent: id('g') } as never);
    page.setLayer(id('g'), 'top');
    sync();
    page.undo();
    sync();
    expect(page.get(id('m'))!.layer).toBe('top');
    expect(mirror.scene!.toJSON()).toEqual(page.toJSON());
  });

  it('takes a node into a group on a higher layer in the same sync that raises it there', () => {
    const page = createScene<unknown, string, RectPose>({ systemLayers: [{ id: 'low' }, { id: 'high' }] }) as unknown as AnyScene;
    const diff = createSceneDiff(), mirror = createSceneMirror();
    const sync = () => {
      const delta = diff.next(page);
      if (delta) mirror.apply(structuredClone(delta));
    };
    page.add({ id: id('g'), kind: 'group', layer: 'high', pose: box, data: null } as never);
    page.add({ id: id('n'), kind: 'mark', layer: 'low', pose: box, data: null } as never);
    sync();
    page.setLayer(id('n'), 'high');
    page.move(id('n'), id('g'));
    sync();
    expect(mirror.scene!.toJSON()).toEqual(page.toJSON());
  });
});
