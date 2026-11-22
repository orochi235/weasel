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
  it('puts each node back as it was when its edit is canceled, outside undo', () => {
    const { scene, selection, pose } = setup();
    scene.add({ id: asNodeId('b'), kind: 'mark', layer: 'default', pose: { x: 0, opacity: 0.2 }, data: { kind: 'thing' } });
    const both = { current: [...selection.current, asNodeId('b')] };
    const before = scene.historyEntries().length;
    const w = leafWrites(scene);
    w.draft(both, leaf, () => 0.7);
    // A canceled edit hands its one starting value back through the drafts first, over a mixed selection too.
    w.draft(both, leaf, () => 0.5);
    w.cancel!(leaf);
    expect([pose().opacity, scene.get(asNodeId('b'))!.pose.opacity]).toEqual([0.5, 0.2]);
    expect(scene.historyEntries()).toHaveLength(before);
  });

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

describe('commitLeaf — a declared field', () => {
  it('writes no part of a scope into a node that declares none, and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scene = createScene<{ kind: string }, 'default', Record<string, number>>({
      composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'default' }],
    });
    const system = { base: 'in', units: { in: 1 } };
    scene.add({ id: asNodeId('bare'), kind: 'mark', layer: 'default', pose: { x: 0 }, data: { kind: 'thing' } });
    scene.add({ id: asNodeId('scoped'), kind: 'group', layer: 'default', pose: { x: 0 }, data: { kind: 'thing' }, units: { system } });
    const drawnAt = { path: 'units.drawnAt', leaf: { kind: 'number', name: 'Drawn at', description: '', default: 1 } as PrefLeaf };
    leafWrites(scene).commit({ current: [asNodeId('bare'), asNodeId('scoped')] }, drawnAt, () => 0.4);
    expect(scene.get(asNodeId('bare'))!.units ?? null).toBeNull();
    expect(scene.get(asNodeId('scoped'))!.units).toEqual({ system, drawnAt: 0.4 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('units.drawnAt'));
    warn.mockRestore();
  });
});
