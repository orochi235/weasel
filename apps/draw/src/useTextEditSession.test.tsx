import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asNodeId, createScene, textEditJoin } from '@weasel-js/core';
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

/** A real scene history under the machine, and a text box inserted as the insert dep makes one. */
function inserted(journalSoftModes: boolean) {
  const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: [{ id: 'default' }] });
  scene.add({ kind: 'mark', layer: 'default', id: asNodeId('old'), pose: { x: 0, y: 0, width: 100, height: 40 }, data: { text: 'kept' } });
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: scene.history, journalSoftModes: () => journalSoftModes });
  scene.setActiveJournalAccessor(() => machine.getActiveJournal());
  const host = document.createElement('div');
  document.body.appendChild(host);
  const { result } = renderHook(() => useTextEditSession(scene, host, machine));
  const entries = scene.historyEntries().length;
  scene.batch('Insert text', () => {
    scene.add({ kind: 'mark', layer: 'default', id: asNodeId('t'), pose: { x: 0, y: 50, width: 100, height: 40 }, data: { text: '' } });
  }, textEditJoin('t'));
  return { scene, entries, edit: () => result.current };
}

describe.each([true, false])('a text box drawn and left empty (soft modes journaled: %s)', (journaled) => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves nothing for undo to bring back', () => {
    const { scene, entries, edit } = inserted(journaled);
    act(() => edit().startEdit('t', { caret: 0 }));
    act(() => edit().cancelEdit());
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.historyEntries().length).toBeLessThanOrEqual(entries + 1);
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    expect(scene.get(asNodeId('old'))).toBeDefined();
    act(() => { scene.redo(); });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
  });
});

describe.each([true, false])('a text box drawn and typed into (soft modes journaled: %s)', (journaled) => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('is one undo entry with its insert', () => {
    const { scene, entries, edit } = inserted(journaled);
    act(() => edit().startEdit('t', { caret: 0 }));
    // The edit's commit, as the overlay makes it.
    act(() => { scene.batch('Edit text', () => scene.update(asNodeId('t'), { data: { text: 'Hi' } }), textEditJoin('t')); });
    act(() => edit().cancelEdit());
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
    expect(scene.historyEntries().length).toBe(entries + 1);
    act(() => { scene.undo(); });
    expect(scene.get(asNodeId('t'))).toBeUndefined();
    act(() => { scene.redo(); });
    expect(scene.get(asNodeId('t'))?.data.text).toBe('Hi');
  });
});
