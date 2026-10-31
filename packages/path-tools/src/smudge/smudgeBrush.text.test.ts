/**
 * The Smudge brush over text, against a real scene and a real font: the
 * conversion, its slot, and the one undo entry are scene surgery a stub would
 * let slide.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import { applyCreateOutlines, asNodeId } from '@weasel-js/core';
import { loadTestFont, outlineScene as setup, TEXT, type Data } from '../shared/testing/outlineScene';
import { smudgeBrushAction } from './smudgeBrush';

const at = (deps: never, x: number, y: number) => ({ deps, world: { x, y } }) as unknown as InvocationCtx;
const invoker = smudgeBrushAction.invoker as OngoingInvoker;
const PARAMS = { params: { radiusPx: 30, strength: 1 } };

/** A stroke from (x, y0) to (x, y1) in a few dabs, ended with `reason`. */
function stroke(deps: never, x: number, y0: number, y1: number, reason: 'commit' | 'cancel' = 'commit') {
  const handle = invoker.start(at(deps, x, y0), PARAMS);
  for (let i = 1; i <= 4; i++) handle.onMove?.(at(deps, x, y0 + ((y1 - y0) * i) / 4));
  handle.onEnd?.(at(deps, x, y1), reason);
  return handle;
}

beforeEach(loadTestFont);

describe('smudgeBrushAction over text', () => {
  it('converts text the brush reaches to outlines and smudges them, as one undo entry', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    scene.history.clear();
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Smudge brush']);
    const plain = setup();
    plain.add('t', TEXT());
    applyCreateOutlines(plain.adapter, [asNodeId('t')]);
    const paths = (s: typeof scene) => s.renderOrderNodes().filter((n) => n.data.path).map((n) => JSON.stringify(n.data.path));
    expect(paths(scene)).toHaveLength(paths(plain.scene).length);
    expect(paths(scene)).not.toEqual(paths(plain.scene));
    scene.undo();
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect(scene.renderOrderNodes().every((n) => !n.data.path)).toBe(true);
  });

  it('leaves text the brush never reaches as text', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    add('far', { path: { kind: 'rect', x: 1000, y: 1000, width: 50, height: 50 } });
    stroke(deps, 1025, 990, 1010);
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });

  it('with a selection, converts only selected text', () => {
    const { scene, add, deps } = setup();
    add('a', TEXT());
    add('b', TEXT());
    scene.setSelection([asNodeId('b')]);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('a'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('b'))).toBeUndefined();
  });

  it('keeps the outlines selected, and a selected group is smudged as its leaves', () => {
    const { scene, add, deps } = setup();
    // Two paints: two paths, in a group.
    add('t', { ...TEXT(), runs: [{ text: 'H' }, { text: 'i', fill: { paint: { kind: 'solid', color: '#00c' } } }] } as Data);
    scene.setSelection([asNodeId('t')]);
    stroke(deps, 30, 60, 20);
    const [group] = scene.getSelection();
    expect(scene.get(group)?.kind).toBe('group');
    scene.history.clear();
    stroke(deps, 30, 70, 30);
    expect(scene.history.undoDepth()).toBe(1);
  });

  it('with nothing selected, passes over locked and hidden text', () => {
    const { scene, add, deps } = setup();
    add('locked', TEXT(), { locked: true });
    add('hidden', TEXT(), { hidden: true });
    expect(smudgeBrushAction.enabled!(deps)).not.toBe(true);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('locked'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('hidden'))?.data.text).toBe('Hi');
  });

  it('puts the text back exactly when the stroke is canceled', () => {
    const { scene, add, deps } = setup();
    add('t', TEXT());
    scene.history.clear();
    const before = JSON.stringify(scene.toJSON());
    stroke(deps, 30, 60, 20, 'cancel');
    expect(JSON.stringify(scene.toJSON())).toBe(before);
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('leaves text whose face has no outlines, and says so once', () => {
    const { scene, add, deps, notices } = setup();
    add('a', TEXT('nowhere'));
    add('b', TEXT('nowhere'));
    scene.history.clear();
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('a'))?.data.text).toBe('Hi');
    expect(scene.get(asNodeId('b'))?.data.text).toBe('Hi');
    expect(notices.warn).toHaveBeenCalledTimes(1);
    expect(notices.warn.mock.calls[0][0]).toContain('nowhere');
    expect(scene.history.undoDepth()).toBe(0);
  });

  it('skips text in a host with no outlines adapter', () => {
    const { scene, add, deps } = setup({ outlines: false });
    add('t', TEXT());
    expect(smudgeBrushAction.enabled!(deps)).not.toBe(true);
    stroke(deps, 30, 60, 20);
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });
});
