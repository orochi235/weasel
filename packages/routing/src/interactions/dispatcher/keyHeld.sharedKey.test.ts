import { describe, it, expect, vi, type Mock } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { Action } from '../actions/action';
import type { Contribution } from '../../contributions/types';
import type { InputEvent } from './matcher';
import { makeCtx, makeRegistry } from './testing/dispatcherStubs';

const NO_MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const spaceDown: InputEvent = { kind: 'key-held', key: ' ', phase: 'down', ...NO_MODS };
const spaceUp: InputEvent = { kind: 'key-held', key: ' ', phase: 'up', ...NO_MODS };
const keyX: InputEvent = { kind: 'key', key: 'x', ...NO_MODS };

function holdAction(id: string, start: Mock): Action {
  return { id, label: id, invoker: { timing: 'ongoing', start } };
}

function engagedAction(id: string, run: () => void): Action {
  return { id, label: id, invoker: { timing: 'immediate', run } };
}

function setup() {
  const focusedEnd = vi.fn();
  const ambientEnd = vi.fn();
  const focusedEngaged = vi.fn();
  const ambientEngaged = vi.fn();
  const focusedStart = vi.fn().mockReturnValue({ onEnd: focusedEnd });
  const ambientStart = vi.fn().mockReturnValue({ onEnd: ambientEnd });
  const focused: Contribution = {
    id: 'focused',
    eligibility: { focus: true },
    bindings: [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'focused.hold' },
      { spec: { kind: 'key', key: 'x', phase: 'engaged' }, actionId: 'focused.engaged' },
    ],
  };
  const ambient: Contribution = {
    id: 'ambient',
    eligibility: { always: true },
    bindings: [
      { spec: { kind: 'key-held', key: ' ', phase: 'initial' }, actionId: 'ambient.hold' },
      { spec: { kind: 'key', key: 'x', phase: 'engaged' }, actionId: 'ambient.engaged' },
    ],
  };
  const ctx = makeCtx({
    actions: makeRegistry([
      holdAction('focused.hold', focusedStart),
      holdAction('ambient.hold', ambientStart),
      engagedAction('focused.engaged', focusedEngaged),
      engagedAction('ambient.engaged', ambientEngaged),
    ]),
    activeToolId: 'focused',
    entriesById: new Map([['focused', focused], ['ambient', ambient]]),
  });
  return { ctx, focusedStart, ambientStart, focusedEnd, ambientEnd, focusedEngaged, ambientEngaged };
}

describe('two entries holding the same key', () => {
  it('engages only the best-ranked entry, and a repeat keydown does not engage the other', () => {
    const s = setup();
    const dispatcher = createDispatcher();

    expect(dispatcher.handleInput(spaceDown, s.ctx)).toBe('handled');
    expect(dispatcher.handleInput(spaceDown, s.ctx)).toBe('handled');

    expect(s.focusedStart).toHaveBeenCalledOnce();
    expect(s.ambientStart).not.toHaveBeenCalled();
    expect(dispatcher.inFlight().size).toBe(1);

    dispatcher.handleInput(keyX, s.ctx);
    expect(s.focusedEngaged).toHaveBeenCalledOnce();
    expect(s.ambientEngaged).not.toHaveBeenCalled();
  });

  it('releasing the key ends the one engagement and leaves no channel engaged', () => {
    const s = setup();
    const dispatcher = createDispatcher();

    dispatcher.handleInput(spaceDown, s.ctx);
    expect(dispatcher.handleInput(spaceUp, s.ctx)).toBe('handled');

    expect(s.focusedEnd).toHaveBeenCalledOnce();
    expect(s.ambientEnd).not.toHaveBeenCalled();
    expect(dispatcher.inFlight().size).toBe(0);
    expect(dispatcher.handleInput(keyX, s.ctx)).toBe('unhandled');
  });

  it('falls to the other entry when the best-ranked one declines the hold', () => {
    const s = setup();
    s.focusedStart.mockReturnValue({});
    const dispatcher = createDispatcher();

    dispatcher.handleInput(spaceDown, s.ctx);
    dispatcher.handleInput(keyX, s.ctx);
    expect(s.ambientEngaged).toHaveBeenCalledOnce();
    expect(s.focusedEngaged).not.toHaveBeenCalled();

    dispatcher.handleInput(spaceUp, s.ctx);
    expect(s.ambientEnd).toHaveBeenCalledOnce();
    expect(dispatcher.handleInput(keyX, s.ctx)).toBe('unhandled');
  });
});
