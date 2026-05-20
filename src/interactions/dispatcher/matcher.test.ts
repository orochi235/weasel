import { describe, it, expect } from 'vitest';
import { matchBest, type InputEvent, type ScopedBinding } from './matcher';
import type { GestureBinding } from '../actions/binding';

const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
// Default wheel event data fields (matcher only reads mods; these are pass-through).
const noWheelData = { deltaX: 0, deltaY: 0, clientX: 0, clientY: 0 };

describe('matchBest (precedence)', () => {
  function binding(spec: any, actionId = 'x'): GestureBinding {
    return { spec, actionId };
  }

  it('returns null when no bindings match', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    expect(matchBest(e, [{ binding: binding({ kind: 'key', key: 'b' }), scope: 'ambient', ownerToolId: null }], false)).toBeNull();
  });

  it('returns null for empty bindings list', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    expect(matchBest(e, [], false)).toBeNull();
  });

  it('returns a single matching binding', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const b = binding({ kind: 'key', key: 'a' }, 'select-all');
    const result = matchBest(e, [{ binding: b, scope: 'ambient', ownerToolId: null }], false);
    expect(result?.binding.actionId).toBe('select-all');
    expect(result?.scope).toBe('ambient');
  });

  it('precedence: hotkey beats active beats ambient', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'ambient-a'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
      { binding: binding({ kind: 'key', key: 'a' }, 'hotkey-a'), scope: 'hotkey', ownerToolId: 'test-tool' },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.binding.actionId).toBe('hotkey-a');
  });

  it('within scope, first-declared wins', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'first'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'second'), scope: 'ambient', ownerToolId: null },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.binding.actionId).toBe('first');
  });

  it('active scope wins over ambient even when both match', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'ambient-a'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('active-a');
  });

  it('hotkey scope wins over active', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
      { binding: binding({ kind: 'key', key: 'a' }, 'hotkey-a'), scope: 'hotkey', ownerToolId: 'test-tool' },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('hotkey-a');
  });

  it('result includes correct scope', () => {
    const e: InputEvent = { kind: 'key', key: 'z', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'z' }, 'z-active'), scope: 'active', ownerToolId: 'test-tool' },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.scope).toBe('active');
  });

  it('wheel gesture routed correctly through matchBest', () => {
    const e: InputEvent = { kind: 'wheel', ...noMods, ...noWheelData, ctrlKey: true };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'wheel', mods: { ctrl: true } }, 'zoom'), scope: 'ambient', ownerToolId: null },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('zoom');
  });
});
