import { describe, expect, it } from 'vitest';
import { describeRoute } from '../grammar/describeRoute';
import { parseRoute } from '../grammar/routeGrammar';
import { routeToSpec } from '../grammar/routeToSpec';
import { matchSpec } from './match';
import type { CarryEvent } from './inputEvent';
import { specificity } from './specificity';

const carry = (over: Partial<CarryEvent> = {}): CarryEvent => ({
  kind: 'carry',
  stage: 'enter',
  type: 'lab/part',
  value: { id: 'a' },
  x: 1, y: 2, clientX: 10, clientY: 20,
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  ...over,
});

describe('matchSpec — carry', () => {
  it('matches a carry coming over the surface and one released on it', () => {
    expect(matchSpec(carry({ stage: 'enter' }), { kind: 'carry' }, false)).toBe(true);
    expect(matchSpec(carry({ stage: 'drop' }), { kind: 'carry' }, false)).toBe(true);
  });

  it('never matches the moves and the leave, which belong to the carry in flight', () => {
    expect(matchSpec(carry({ stage: 'move' }), { kind: 'carry' }, false)).toBe(false);
    expect(matchSpec(carry({ stage: 'leave' }), { kind: 'carry' }, false)).toBe(false);
  });

  it('filters by the payload type as a glob', () => {
    expect(matchSpec(carry(), { kind: 'carry', types: ['lab/*'] }, false)).toBe(true);
    expect(matchSpec(carry(), { kind: 'carry', types: ['lab/part'] }, false)).toBe(true);
    expect(matchSpec(carry(), { kind: 'carry', types: ['text/plain'] }, false)).toBe(false);
  });

  it('is not an OS drop', () => {
    expect(matchSpec(carry(), { kind: 'drop' }, false)).toBe(false);
    expect(matchSpec({ kind: 'drop', items: [], altKey: false, ctrlKey: false, metaKey: false, shiftKey: false },
      { kind: 'carry' }, false)).toBe(false);
  });

  it('holds modifiers to the spec, strictly', () => {
    expect(matchSpec(carry({ shiftKey: true }), { kind: 'carry' }, false)).toBe(false);
    expect(matchSpec(carry({ shiftKey: true }), { kind: 'carry', mods: { shift: true } }, false)).toBe(true);
  });

  it('ranks a typed carry above an untyped one', () => {
    expect(specificity({ kind: 'carry', types: ['lab/*'] })[3])
      .toBeGreaterThan(specificity({ kind: 'carry' })[3]);
  });
});

describe('carry in the route grammar', () => {
  it('reads a route into a spec, types and all', () => {
    expect(routeToSpec(parseRoute('[*:*] carry(lab/*|text/plain)')))
      .toEqual({ kind: 'carry', types: ['lab/*', 'text/plain'] });
    expect(routeToSpec(parseRoute('[*:*] carry'))).toEqual({ kind: 'carry' });
  });

  it('describes the route', () => {
    expect(describeRoute(parseRoute('[*:*] carry(lab/*)'))).toContain('carries lab/* onto the canvas');
  });
});
