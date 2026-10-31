import { describe, it, expect } from 'vitest';
import { createModeMachine } from './machine';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { createHistory, type Op } from '@weasel-js/history';

/** A history over one counter, and an edit that bumps it — sent to the open journal when there is
 *  one, the way the scene sends `applyBatch`. */
function counter(journalSoftModes?: () => boolean) {
  const state = { n: 0 };
  const add = (by: number): Op => ({ apply: () => { state.n += by; }, invert: () => add(-by) });
  const history = createHistory(state);
  const m = createModeMachine({
    modes: DEFAULT_MODES,
    history,
    ...(journalSoftModes ? { journalSoftModes } : {}),
  });
  const bump = (by: number): void => {
    const journal = m.getActiveJournal();
    if (journal) journal.applyBatch([add(by)], 'bump');
    else history.applyOps([add(by)], 'bump');
  };
  return { state, history, m, bump };
}

describe('createModeMachine', () => {
  it('leaveMode closes a soft or a strict mode, keeping its work, and does nothing in normal', () => {
    const { state, history, m, bump } = counter();
    m.leaveMode();
    expect(m.registry.current().id).toBe('normal');
    m.enterMode('path-edit', { targetId: 'p' });
    bump(1);
    m.leaveMode();
    expect(m.registry.current().id).toBe('normal');
    expect(state.n).toBe(1);
    m.enterMode('free-transform', { targetId: 'p' });
    bump(10);
    m.leaveMode();
    expect(m.registry.current().id).toBe('normal');
    expect(state.n).toBe(11);
    expect(history.undoDepth()).toBe(2);
  });

  it('starts in normal mode with no active journal', () => {
    const { m } = counter();
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
  });

  it('a soft mode opens a journal scoped to its target', () => {
    const { m } = counter();
    m.enterMode('path-edit', { targetId: 'path-1' });
    expect(m.registry.current().id).toBe('path-edit');
    expect(m.getActiveJournal()?.targetId).toBe('path-1');
    expect(m.getActiveTargetId()).toBe('path-1');
  });

  it('leaving a soft mode lands its session on the history as one step named for the mode', () => {
    const { state, history, m, bump } = counter();
    bump(1);
    m.enterMode('path-edit', { targetId: 'p' });
    bump(10);
    bump(100);
    m.getActiveJournal()!.undo();
    m.exitMode();
    expect(m.registry.current().id).toBe('normal');
    expect(m.getActiveJournal()).toBe(null);
    expect(m.getActiveTargetId()).toBe(null);
    expect(state.n).toBe(11);
    expect(history.entries().undo.map((e) => e.label)).toEqual(['bump', 'Path Edit']);
    history.undo();
    expect(state.n).toBe(1);
    history.redo();
    expect(state.n).toBe(11);
  });

  it('a session with no edits leaves nothing on the history', () => {
    const { history, m } = counter();
    m.enterMode('path-edit', { targetId: 'p' });
    m.exitMode();
    expect(history.undoDepth()).toBe(0);
  });

  it('re-entering the same target opens a fresh journal', () => {
    const { m, bump } = counter();
    m.enterMode('path-edit', { targetId: 'p' });
    bump(10);
    m.exitMode();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(m.getActiveJournal()!.canUndo()).toBe(false);
  });

  it("discardMode takes back a soft mode's session and records nothing", () => {
    const { state, history, m, bump } = counter();
    bump(1);
    m.enterMode('path-edit', { targetId: 'p' });
    bump(10);
    m.discardMode();
    expect(state.n).toBe(1);
    expect(history.undoDepth()).toBe(1);
    expect(m.registry.current().id).toBe('normal');
  });

  it('commitMode lands a strict mode as one step; cancelMode takes it back', () => {
    const { state, history, m, bump } = counter();
    m.enterMode('free-transform', { targetId: 'sel' });
    bump(10);
    bump(100);
    m.commitMode();
    expect(history.entries().undo.map((e) => e.label)).toEqual(['Free Transform']);
    m.enterMode('free-transform', { targetId: 'sel' });
    bump(1000);
    m.cancelMode();
    expect(state.n).toBe(110);
    expect(history.undoDepth()).toBe(1);
  });

  it('leaves a strict mode only by commit or cancel, and a soft one only by exit or discard', () => {
    const { m } = counter();
    m.enterMode('free-transform', { targetId: 'sel' });
    m.exitMode();
    m.discardMode();
    expect(m.registry.current().id).toBe('free-transform');
    m.cancelMode();
    m.enterMode('path-edit', { targetId: 'p' });
    m.commitMode();
    m.cancelMode();
    expect(m.registry.current().id).toBe('path-edit');
  });

  it('enterMode while already in a mode throws', () => {
    const { m } = counter();
    m.enterMode('path-edit', { targetId: 'a' });
    expect(() => m.enterMode('free-transform', { targetId: 'b' })).toThrow();
  });

  it('enterMode("normal") is a no-op', () => {
    const { m } = counter();
    m.enterMode('normal', {});
    expect(m.getActiveJournal()).toBe(null);
  });
});

describe('soft modes with journalSoftModes off', () => {
  it('records each edit on the history and opens no journal', () => {
    const { state, history, m, bump } = counter(() => false);
    bump(1);
    m.enterMode('path-edit', { targetId: 'p' });
    expect(m.getActiveJournal()).toBe(null);
    expect(m.getActiveTargetId()).toBe('p');
    bump(10);
    bump(100);
    expect(history.undoDepth()).toBe(3);
    history.undo();
    expect(state.n).toBe(11);
    m.exitMode();
    expect(m.registry.current().id).toBe('normal');
    expect(history.undoDepth()).toBe(2);
  });

  it('discardMode takes back only the edits made since entering', () => {
    const { state, history, m, bump } = counter(() => false);
    bump(1);
    m.enterMode('path-edit', { targetId: 'p' });
    bump(10);
    bump(100);
    m.discardMode();
    expect(state.n).toBe(1);
    expect(history.undoDepth()).toBe(1);
    expect(m.registry.current().id).toBe('normal');
  });

  it('still journals a strict mode', () => {
    const { m } = counter(() => false);
    m.enterMode('free-transform', { targetId: 'sel' });
    expect(m.getActiveJournal()).not.toBe(null);
  });
});
