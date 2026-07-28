import { describe, it, expect } from 'vitest';
import { buildRouteRegistry, PREDICATE_TARGET, type RegistryEntry } from './registry';
import type { Tool } from '../../types';

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

describe('buildRouteRegistry', () => {
  it('returns an empty array for no tools', () => {
    expect(buildRouteRegistry([])).toEqual([]);
  });

  it('returns an empty array for a tool with no bindings', () => {
    expect(buildRouteRegistry([tool('select', [])])).toEqual([]);
  });

  it('flattens one row per binding', () => {
    const r = buildRouteRegistry([tool('select', [
      { spec: { kind: 'click', target: 'empty' }, actionId: 'clearSelection' },
      { spec: { kind: 'drag', target: 'selected-body' }, actionId: 'move' },
    ])]);
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'clearSelection', phase: 'any',
      gesture: 'click', arg: undefined, target: 'empty', modifiers: {},
      spec: { kind: 'click', target: 'empty' },
    });
    expect(r).toContainEqual<RegistryEntry>({
      toolId: 'select', actionId: 'move', phase: 'any',
      gesture: 'drag', arg: undefined, target: 'selected-body', modifiers: {},
      spec: { kind: 'drag', target: 'selected-body' },
    });
    expect(r).toHaveLength(2);
  });

  it('maps spec kinds onto route-grammar gesture names', () => {
    const r = buildRouteRegistry([tool('t', [
      { spec: { kind: 'key', key: 'Escape' }, actionId: 'a' },
      { spec: { kind: 'key-held', key: ' ' }, actionId: 'b' },
      { spec: { kind: 'doubleClick' }, actionId: 'c' },
      { spec: { kind: 'pointerDown' }, actionId: 'd' },
    ])]);
    expect(r.map((e) => e.gesture)).toEqual(['keyDown', 'keyHeld', 'dblTap', 'pointerDown']);
  });

  it('skips kinds the route grammar has no name for', () => {
    const r = buildRouteRegistry([tool('t', [
      { spec: { kind: 'drop' }, actionId: 'ingest' },
      { spec: { kind: 'paste' }, actionId: 'ingest' },
      { spec: { kind: 'multiTouch', fingers: 2 }, actionId: 'pinch' },
      { spec: { kind: 'click' }, actionId: 'keep' },
    ])]);
    expect(r.map((e) => e.actionId)).toEqual(['keep']);
  });

  it('carries the gesture arg for arg-bearing kinds', () => {
    const r = buildRouteRegistry([tool('t', [
      { spec: { kind: 'key', key: 'ArrowUp' }, actionId: 'nudge' },
      { spec: { kind: 'key', key: ['a', 'b'] }, actionId: 'either' },
      { spec: { kind: 'wheel', direction: 'up' }, actionId: 'zoomIn' },
      { spec: { kind: 'wheel' }, actionId: 'zoomAny' },
      { spec: { kind: 'multiTouchTap', fingers: 2 }, actionId: 'undo' },
    ])]);
    expect(r.map((e) => e.arg)).toEqual(['ArrowUp', 'a|b', 'up', '*', '2']);
  });

  it('reports a predicate target as such — the grammar cannot name a function', () => {
    const r = buildRouteRegistry([tool('select', [
      { spec: { kind: 'drag', target: { kindOf: () => true } }, actionId: 'resize' },
    ])]);
    expect(r[0].target).toBe(PREDICATE_TARGET);
  });

  it('leaves target undefined for targetless gestures and untargeted specs', () => {
    const r = buildRouteRegistry([tool('t', [
      { spec: { kind: 'key', key: 'Escape', target: 'empty' }, actionId: 'escape' },
      { spec: { kind: 'click' }, actionId: 'anywhere' },
    ])]);
    expect(r.map((e) => e.target)).toEqual([undefined, undefined]);
  });

  it('translates ModSpec into the parsed form, dropping must-not-be-held keys', () => {
    const r = buildRouteRegistry([tool('t', [
      { spec: { kind: 'click', mods: { shift: true, alt: 'optional', meta: false } }, actionId: 'a' },
      { spec: { kind: 'click', mods: {} }, actionId: 'b' },
      { spec: { kind: 'click' }, actionId: 'c' },
    ])]);
    expect(r[0].modifiers).toEqual({ shift: 'required', alt: 'optional' });
    expect(r[1].modifiers).toEqual({});
    expect(r[2].modifiers).toEqual({});
  });

  it('reports the engaged phase only when the spec restricts to it', () => {
    const r = buildRouteRegistry([tool('polygon', [
      { spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'polygon.adjustSides' },
      { spec: { kind: 'wheel' }, actionId: 'zoom' },
      { spec: { kind: 'wheel', phase: 'initial' }, actionId: 'other' },
    ])]);
    expect(r.map((e) => e.phase)).toEqual(['engaged', 'any', 'initial']);
  });

  it('walks every tool it is given', () => {
    const r = buildRouteRegistry([
      tool('a', [{ spec: { kind: 'click' }, actionId: 'x' }]),
      tool('b', [{ spec: { kind: 'click' }, actionId: 'y' }]),
    ]);
    expect(r.map((e) => e.toolId)).toEqual(['a', 'b']);
  });

  it('carries the source spec on each row', () => {
    const spec = { kind: 'drag', target: 'selected-body', mods: { shift: true } };
    const r = buildRouteRegistry([tool('select', [{ spec, actionId: 'move' }])]);
    expect(r).toHaveLength(1);
    expect(r[0].spec).toBe(spec);
  });

  describe('phase resolution', () => {
    const phaseOfBinding = (phase: unknown) =>
      buildRouteRegistry([tool('t', [
        { spec: phase === undefined ? { kind: 'click' } : { kind: 'click', phase }, actionId: 'a' },
      ])])[0].phase;

    it('reports an unrestricted binding as any', () => {
      expect(phaseOfBinding(undefined)).toBe('any');
    });

    it('reports the string forms verbatim', () => {
      expect(phaseOfBinding('initial')).toBe('initial');
      expect(phaseOfBinding('engaged')).toBe('engaged');
    });

    it('reports the wildcard as any', () => {
      expect(phaseOfBinding('*')).toBe('any');
    });

    it('reports an atom array by its agreed phase', () => {
      expect(phaseOfBinding([{ channel: '*', phase: 'engaged' }])).toBe('engaged');
      expect(phaseOfBinding([{ channel: '*', phase: 'initial' }])).toBe('initial');
      expect(phaseOfBinding([
        { channel: '&', phase: 'engaged' },
        { channel: 'select', phase: 'engaged' },
      ])).toBe('engaged');
    });

    it('reports any when atoms disagree or any atom is a wildcard', () => {
      expect(phaseOfBinding([
        { channel: '&', phase: 'initial' },
        { channel: 'select', phase: 'engaged' },
      ])).toBe('any');
      expect(phaseOfBinding([{ channel: '*', phase: '*' }])).toBe('any');
    });

    it('reports an empty atom array as any', () => {
      expect(phaseOfBinding([])).toBe('any');
    });
  });
});
