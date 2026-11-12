/**
 * A host that unmounts with a mode open leaves it as leaving the mode would. Left open, the mode's
 * journal stays the scene's innermost, so every later edit, and every later journal, lands in it
 * and never reaches the history.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { asNodeId, createScene } from '@weasel-js/core';
import { useModality } from './useModality';

describe('useModality unmounted mid-mode', () => {
  it('closes the mode journal, keeping its edits, so later edits land on the history', () => {
    const scene = createScene<{ label?: string }, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
    const { result, unmount } = renderHook(() => useModality(scene as never));
    const machine = result.current.machine;
    machine.enterMode('free-transform', { targetId: null });
    expect(machine.getActiveJournal()).not.toBeNull();
    unmount();
    expect(scene.history.activeJournal?.()).toBeNull();
    scene.add({ id: asNodeId('n'), kind: 'mark', data: {}, layer: 'main', pose: { x: 0, y: 0, width: 1, height: 1 } });
    expect(scene.history.undoDepth()).toBe(1);
    expect(machine.registry.current().id).toBe('normal');
    expect(machine.getActiveJournal()).toBeNull();
  });
});
