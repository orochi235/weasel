/**
 * One entry can satisfy several conditions at once — the hand tool is
 * palette-selectable and space-held — so this resolves to the HIGHEST-priority
 * live tier, matching the dispatcher's existing hotkey > active > ambient walk.
 */
import { describe, expect, it } from 'vitest';
import { liveScope } from './eligibility';
import type { Eligibility } from './types';

const state = { focusedId: 'hand', heldTriggers: new Set<string>() };

describe('liveScope', () => {
  it('gives the focused entry active scope', () => {
    const e: Eligibility = { focus: true };
    expect(liveScope('hand', e, state)).toBe('active');
  });

  it('gives an unfocused focus-only entry no scope at all', () => {
    const e: Eligibility = { focus: true };
    expect(liveScope('rect', e, state)).toBeNull();
  });

  it('gives an always-on entry ambient scope regardless of focus', () => {
    expect(liveScope('viewport', { always: true }, state)).toBe('ambient');
  });

  it('gives a claimed-only entry ambient scope', () => {
    expect(liveScope('weasel-hud', { claimed: true }, state)).toBe('ambient');
  });

  it('prefers hotkey over active when both conditions are live', () => {
    // The hand tool, focused AND space-held. The dispatcher walks hotkey first,
    // so reporting 'active' here would change which tier its bindings land in.
    const held = { focusedId: 'hand', heldTriggers: new Set(['space']) };
    expect(liveScope('hand', { focus: true, offhand: 'space' }, held)).toBe('hotkey');
  });

  it('gives an offhand entry no scope while its trigger is up', () => {
    expect(liveScope('hand', { offhand: 'space' }, state)).toBeNull();
  });
});

describe('liveScope honors the capability filter', () => {
  const focused = { focusedId: 'pen', heldTriggers: new Set<string>() };

  it('withholds scope from an entry the active mode disallows', () => {
    const e: Eligibility = { focus: true, capabilities: ['creates-paths'] };
    expect(liveScope('pen', e, { ...focused, allows: () => false })).toBeNull();
  });

  it('grants scope when the mode allows the entry', () => {
    const e: Eligibility = { focus: true, capabilities: ['creates-paths'] };
    expect(liveScope('pen', e, { ...focused, allows: () => true })).toBe('active');
  });

  it('ignores the filter when the entry declares no capabilities', () => {
    expect(liveScope('pen', { focus: true }, { ...focused, allows: () => false })).toBe('active');
  });

  it('asks the mode about an explicitly empty tag list', () => {
    // `eligibleForMode` returns false for an empty list, so without the
    // length check a `capabilities: []` entry would be silently withheld.
    expect(liveScope('pen', { focus: true, capabilities: [] }, { ...focused, allows: () => false })).toBe('active');
  });
});
