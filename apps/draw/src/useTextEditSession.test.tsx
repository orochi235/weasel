import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asNodeId, createScene } from '@weasel-js/core';
import { DEFAULT_MODES } from '@weasel-js/modes';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { createModeMachine } from './modality/machine';
import { useTextEditSession } from './useTextEditSession';

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}

function session(texts: Record<string, string>) {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  for (const [id, text] of Object.entries(texts)) {
    scene.add({
      kind: 'mark', layer: 'default', id: asNodeId(id),
      pose: { x: 0, y: 0, width: 100, height: 40 },
      data: { text },
    });
  }
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });
  const host = document.createElement('div');
  document.body.appendChild(host);
  const { result } = renderHook(() => useTextEditSession(scene, host, machine));
  const mode = (): string => machine.registry.current().id;
  return { scene, machine, mode, edit: () => result.current };
}

describe('useTextEditSession keeps the text-edit mode in step with the edit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('enters the mode on the node when an edit starts, whatever started it', () => {
    const { machine, mode, edit } = session({ t: 'Hello' });
    act(() => edit().startEdit('t'));
    expect(mode()).toBe('text-edit');
    expect(machine.getActiveTargetId()).toBe('t');
  });

  it('leaves the mode when the edit ends', () => {
    const { mode, edit } = session({ t: 'Hello' });
    act(() => edit().startEdit('t'));
    act(() => edit().commit());
    expect(mode()).toBe('normal');
  });

  it('closes the edit when the mode is left under it', () => {
    const { machine, edit } = session({ t: 'Hello' });
    act(() => edit().startEdit('t'));
    act(() => machine.exitMode());
    expect(edit().editingId).toBeNull();
  });

  it('follows the edit from one node to another', () => {
    const { machine, mode, edit } = session({ t: 'Hello', u: 'World' });
    act(() => edit().startEdit('t'));
    act(() => edit().startEdit('u'));
    expect(mode()).toBe('text-edit');
    expect(machine.getActiveTargetId()).toBe('u');
    expect(edit().editingId).toBe('u');
  });

  it('opens an edit from inside another soft mode, which it leaves', () => {
    const { machine, mode, edit } = session({ t: 'Hello' });
    machine.enterMode('path-edit', { targetId: 'p' });
    act(() => edit().startEdit('t'));
    expect(mode()).toBe('text-edit');
    expect(edit().editingId).toBe('t');
  });

  it('removes a node whose edit ends with no text', () => {
    const { scene, edit } = session({ t: '' });
    act(() => edit().startEdit('t'));
    act(() => edit().cancelEdit());
    expect(scene.get(asNodeId('t'))).toBeUndefined();
  });
});
