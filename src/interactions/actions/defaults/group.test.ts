/**
 * Tests for groupAction / ungroupAction descriptors.
 */
import { describe, it, expect } from 'vitest';
import { groupAction, ungroupAction } from './group';

describe('groupAction (descriptor)', () => {
  it('id="group", label="Group"', () => {
    expect(groupAction.id).toBe('group');
    expect(groupAction.label).toBe('Group');
  });

  it('gestureBinding = { kind: "key", key: "g", mods: { mod: true } }', () => {
    expect(groupAction.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(groupAction.invoker?.timing).toBe('immediate');
  });
});

describe('ungroupAction (descriptor)', () => {
  it('id="ungroup", label="Ungroup"', () => {
    expect(ungroupAction.id).toBe('ungroup');
    expect(ungroupAction.label).toBe('Ungroup');
  });

  it('gestureBinding = { kind: "key", key: "g", mods: { mod: true, shift: true } }', () => {
    expect(ungroupAction.gestureBinding).toEqual({ kind: 'key', key: 'g', mods: { mod: true, shift: true } });
  });

  it('invoker.timing = "immediate"', () => {
    expect(ungroupAction.invoker?.timing).toBe('immediate');
  });
});
