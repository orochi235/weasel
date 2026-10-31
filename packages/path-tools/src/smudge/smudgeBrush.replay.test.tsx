/**
 * The Smudge brush as the last operation: a change of Size or Strength replays
 * every dab from the stroke's start, text put back and converted again where
 * the brush at its new size meets it, as one undo entry.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import { PathBuilder } from '@weasel-js/geom';
import type { InvocationCtx } from '@weasel-js/routing';
import { asNodeId } from '@weasel-js/core';
import { loadTestFont, outlineScene, TEXT } from '../shared/testing/outlineScene';
import { lastOperationHarness } from '../shared/testing/lastOperation';
import { smudgeBrushAction } from './smudgeBrush';

const at = (deps: never, x: number, y: number) => ({ deps, world: { x, y } }) as unknown as InvocationCtx;
/** A 300 by 10 bar whose top edge is at `y`, posed where its path is. */
const bar = (y: number) => [
  { path: new PathBuilder().moveTo(0, y).lineTo(300, y).lineTo(300, y + 10).lineTo(0, y + 10).close().build() },
  { pose: { x: 0, y, width: 300, height: 10 } },
] as const;

function setup() {
  const t = outlineScene();
  const harness = lastOperationHarness(t.deps as Record<string, unknown>, [smudgeBrushAction]);
  /** A stroke straight from (x, y0) to (x, y1) in four dabs. */
  const stroke = (x: number, y0: number, y1: number, params: Record<string, unknown>) => act(() => {
    const handle = harness.start('smudgeBrush', at(t.deps, x, y0), params);
    for (let i = 1; i <= 4; i++) handle.onMove?.(at(t.deps, x, y0 + ((y1 - y0) * i) / 4));
    handle.onEnd?.(at(t.deps, x, y1), 'commit');
  });
  return { ...t, ...harness, stroke };
}

const pathOf = (scene: ReturnType<typeof setup>['scene'], id: string) => JSON.stringify(scene.get(asNodeId(id))?.data.path);

beforeEach(loadTestFont);

describe('the Smudge brush in the last-operation panel', () => {
  it('shows Size and Strength after a stroke, and replays it with new ones as one undo entry', () => {
    const { scene, add, store, stroke, adjust } = setup();
    add('a', ...bar(300));
    add('b', ...bar(330));
    scene.setSelection([asNodeId('a'), asNodeId('b')]);
    scene.history.clear();
    const before = pathOf(scene, 'b');
    stroke(150, 300, 290, { radiusPx: 20, strength: 1 });
    expect(store.get()).toMatchObject({ id: 'smudgeBrush', label: 'Smudge brush', values: { radiusPx: 20, strength: 1 } });
    // 20 px from y 300 never reaches the line at 330.
    expect(pathOf(scene, 'b')).toBe(before);
    const small = pathOf(scene, 'a');
    adjust({ radiusPx: 60 });
    expect(pathOf(scene, 'b')).not.toBe(before);
    expect(pathOf(scene, 'a')).not.toBe(small);
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Smudge brush']);
    expect(store.get()?.values).toEqual({ radiusPx: 60, strength: 1 });
    expect([...scene.getSelection()]).toEqual(['a', 'b']);
    adjust({ radiusPx: 20 });
    expect(pathOf(scene, 'a')).toBe(small);
    act(() => { scene.undo(); });
    expect(pathOf(scene, 'b')).toBe(before);
  });

  it('converts text again on replay, putting it back where the brush no longer reaches it', () => {
    const { scene, add, stroke, adjust } = setup();
    add('t', TEXT());
    scene.setSelection([asNodeId('t')]);
    scene.history.clear();
    // The text's drawn box is near (0..200, 0..120); a stroke at y 160 reaches it only with a big brush.
    stroke(100, 170, 160, { radiusPx: 60, strength: 0.6 });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.history.undoDepth()).toBe(1);
    adjust({ radiusPx: 10 });
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect(scene.history.undoDepth()).toBe(0);
    adjust({ radiusPx: 60 });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.history.entries().undo.map((e) => e.label)).toEqual(['Smudge brush']);
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect([...scene.getSelection()]).toEqual(['t']);
  });

  it('replays a stroke over a selected group as its leaves, one undo entry', () => {
    const { scene, add, stroke, adjust } = setup();
    add('g', {}, { kind: 'group' });
    add('a', bar(300)[0], { ...bar(300)[1], parent: asNodeId('g') });
    add('b', bar(320)[0], { ...bar(320)[1], parent: asNodeId('g') });
    scene.setSelection([asNodeId('g')]);
    scene.history.clear();
    stroke(150, 300, 290, { radiusPx: 15, strength: 1 });
    const b = pathOf(scene, 'b');
    adjust({ radiusPx: 50, strength: 0.5 });
    expect(pathOf(scene, 'b')).not.toBe(b);
    expect(scene.history.undoDepth()).toBe(1);
    expect([...scene.getSelection()]).toEqual(['g']);
  });
});
