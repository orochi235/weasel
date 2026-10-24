import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { enterModeOn } from './enterModeOn';
import { createModeMachine } from './machine';

function fakeHistory() {
  return {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
}
const machine = () => createModeMachine({ modes: DEFAULT_MODES, history: fakeHistory() as never });

describe('enterModeOn', () => {
  it('enters from normal', () => {
    const m = machine();
    enterModeOn(m, 'path-edit', 'p');
    expect(m.registry.current().id).toBe('path-edit');
    expect(m.getActiveTargetId()).toBe('p');
  });

  it('changes nothing on the target the mode is already on', () => {
    const m = machine();
    m.enterMode('path-edit', { targetId: 'p' });
    expect(() => enterModeOn(m, 'path-edit', 'p')).not.toThrow();
    expect(m.registry.current().id).toBe('path-edit');
    expect(m.getActiveTargetId()).toBe('p');
  });

  it('leaves a soft mode on something else for the new one', () => {
    const m = machine();
    m.enterMode('text-edit', { targetId: 't' });
    enterModeOn(m, 'path-edit', 'p');
    expect(m.registry.current().id).toBe('path-edit');
    expect(m.getActiveTargetId()).toBe('p');
  });

  it('leaves a strict mode alone', () => {
    const m = machine();
    m.enterMode('crop', {});
    expect(() => enterModeOn(m, 'path-edit', 'p')).not.toThrow();
    expect(m.registry.current().id).toBe('crop');
  });
});
