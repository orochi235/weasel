import { describe, expect, it, vi } from 'vitest';
import { IDENTITY_POSE_COMPOSITION, asNodeId, createScene } from '@weasel-js/core';
import { pref, type PrefLeaf } from '@weasel-js/prefs';
import { leafWrites, warnUnwritable } from './commitLeaf';

const opacity: PrefLeaf = { kind: 'number', name: 'Opacity', description: '', default: 1 };
const leaf = { path: 'pose.opacity', leaf: opacity };

function setup() {
  const scene = createScene<{ kind: string }, 'default', Record<string, number>>({
    composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }],
  });
  scene.add({ id: asNodeId('a'), kind: 'mark', layer: 'default', pose: { x: 0, opacity: 0.5 }, data: { kind: 'thing' } });
  const selection = { current: [asNodeId('a')] };
  return { scene, selection, pose: () => scene.get(asNodeId('a'))!.pose };
}

describe('leafWrites', () => {
  it('keeps a change made between a draft that never committed and the next edit', () => {
    const { scene, selection, pose } = setup();
    const w = leafWrites(scene);
    // A slider dragged away and back fires no change, so these drafts never reach a commit.
    w.draft(selection, leaf, () => 0.7);
    w.draft(selection, leaf, () => 0.5);
    scene.batch('Move', () => scene.setPose(asNodeId('a'), { ...pose(), x: 50 }));
    w.draft(selection, leaf, () => 0.6);
    w.commit(selection, leaf, () => 0.8);
    expect(pose()).toEqual({ x: 50, opacity: 0.8 });
  });

  it('keeps a change made after a draft that never committed, through a reset or a commit sent with no draft', () => {
    for (const end of ['reset', 'commit'] as const) {
      const { scene, selection, pose } = setup();
      const w = leafWrites(scene);
      w.draft(selection, leaf, () => 0.7);
      w.draft(selection, leaf, () => 0.5);
      scene.batch('Move', () => scene.setPose(asNodeId('a'), { ...pose(), x: 50 }));
      if (end === 'reset') w.reset(selection, [leaf], 'Opacity');
      else w.commit(selection, leaf, () => 0.8);
      expect(pose()).toEqual({ x: 50, opacity: end === 'reset' ? 1 : 0.8 });
    }
  });

  it('undoes a committed edit to where it began, before its drafts', () => {
    const { scene, selection, pose } = setup();
    const w = leafWrites(scene);
    w.draft(selection, leaf, () => 0.7);
    w.commit(selection, leaf, () => 0.8);
    expect(pose()).toEqual({ x: 0, opacity: 0.8 });
    scene.undo();
    expect(pose()).toEqual({ x: 0, opacity: 0.5 });
  });
});

describe('warnUnwritable', () => {
  it('warns once per kind and path of a value leaf keyed outside pose, data and the declared fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const color = { path: 'style.color', leaf: pref.color('Color', '#000') };
    warnUnwritable(['rect', 'rect'], [color]);
    warnUnwritable(['rect'], [color]);
    warnUnwritable(['ellipse'], [color]);
    expect(warn.mock.calls.map(([m]) => m as string)).toEqual([
      expect.stringContaining('kind "rect" keys a field at "style.color"'),
      expect.stringContaining('kind "ellipse" keys a field at "style.color"'),
    ]);
    warn.mockRestore();
  });

  it('stays silent for writable paths and leaves that hold no value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnUnwritable(['rect'], [
      leaf,
      { path: 'data.fill', leaf: pref.color('Fill', '#000') },
      { path: 'clip', leaf: opacity },
      { path: 'go', leaf: pref.action('front', { name: 'To front' }) },
    ]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
