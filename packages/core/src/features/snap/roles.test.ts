import { describe, it, expect } from 'vitest';
import { snapMods, SNAP_ROLES } from './roles';
import { createSnapOutcomeStore } from './outcomeStore';

const keys = { alt: false, shift: false, meta: false, ctrl: false };

describe('snapMods', () => {
  it('reads suspend from Ctrl and constrain from Shift by default', () => {
    expect(SNAP_ROLES['snap.suspend'].keys).toEqual(['ctrl']);
    expect(SNAP_ROLES['snap.constrain'].keys).toEqual(['shift']);
    expect(snapMods({ modifiers: { ...keys, ctrl: true } })).toEqual({ suspend: true, constrain: false });
    expect(snapMods({ modifiers: { ...keys, shift: true } })).toEqual({ suspend: false, constrain: true });
  });

  it('answers from the roles the dispatcher resolved', () => {
    expect(snapMods({ roles: { 'snap.suspend': false, 'snap.constrain': true }, modifiers: { ...keys, ctrl: true } }))
      .toEqual({ suspend: false, constrain: true });
  });
});

describe('createSnapOutcomeStore', () => {
  it('notifies on a change and not on clearing an empty store', () => {
    const store = createSnapOutcomeStore();
    let calls = 0;
    const off = store.subscribe(() => { calls++; });
    store.set([]);
    store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]);
    store.set([]);
    off();
    store.set([{ kind: 'line', from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]);
    expect(calls).toBe(2);
  });
});
