import { describe, it, expect } from 'vitest';
import { matchSpec, type GestureSpec } from '@weasel-js/gestures';
import { synthesizeInput, isPredicateTarget, RESOLUTION_GESTURES, RESOLUTION_BODY_TARGETS } from './resolutionInput';

describe('synthesizeInput', () => {
  it('builds a drag-matching event with no modifiers held', () => {
    const e = synthesizeInput({ gesture: 'drag', target: 'empty', mods: {} });
    expect(e.altKey).toBe(false);
    expect(e.shiftKey).toBe(false);
    expect((e as { bodyTarget?: string }).bodyTarget).toBe('empty');
    expect((e as { affordance?: unknown }).affordance).toBeUndefined();
  });

  it('carries held modifiers onto the event', () => {
    const e = synthesizeInput({ gesture: 'click', target: 'empty', mods: { shift: true, alt: true } });
    expect(e.shiftKey).toBe(true);
    expect(e.altKey).toBe(true);
    expect(e.metaKey).toBe(false);
    expect(e.ctrlKey).toBe(false);
  });

  it('synthesizes a minimal AffordanceHit for a chrome target', () => {
    const e = synthesizeInput({ gesture: 'drag', target: 'affordance:rotate-handle', mods: {} });
    expect((e as { affordance?: { kind: string } }).affordance).toEqual({ kind: 'rotate-handle' });
    // bodyTarget is absent: the press landed on chrome, not on a body.
    expect((e as { bodyTarget?: string }).bodyTarget).toBeUndefined();
  });

  it('sets a key for key gestures so the spec key matcher has something to compare', () => {
    const e = synthesizeInput({ gesture: 'key', target: 'empty', mods: {}, key: 'Escape' });
    expect(e.kind).toBe('key');
    expect((e as { key?: string }).key).toBe('Escape');
  });

  it('exposes the pickable gesture kinds and body targets', () => {
    expect(RESOLUTION_GESTURES).toContain('drag');
    expect(RESOLUTION_GESTURES).toContain('click');
    expect(RESOLUTION_BODY_TARGETS).toEqual(['empty', 'selected-body', 'unselected-body']);
  });

  it('sets bodyKind for a node-kind target so kind: specs resolve', () => {
    const e = synthesizeInput({ gesture: 'click', target: 'kind:text', mods: {} });
    expect((e as { bodyKind?: string }).bodyKind).toBe('text');
    expect(matchSpec(e, { kind: 'click', target: 'kind:text' } as GestureSpec, false)).toBe(true);
    expect(matchSpec(e, { kind: 'click', target: 'kind:rect' } as GestureSpec, false)).toBe(false);
  });

  it('a node-kind target lands on an unselected body by default', () => {
    const e = synthesizeInput({ gesture: 'click', target: 'kind:text', mods: {} });
    expect((e as { bodyTarget?: string }).bodyTarget).toBe('unselected-body');
    expect(matchSpec(e, { kind: 'click', target: 'kind:text:selected' } as GestureSpec, false)).toBe(false);
  });

  it('the :selected node-kind target lands on a selected body', () => {
    const e = synthesizeInput({ gesture: 'click', target: 'kind:text:selected', mods: {} });
    expect((e as { bodyTarget?: string }).bodyTarget).toBe('selected-body');
    expect((e as { bodyKind?: string }).bodyKind).toBe('text');
    expect(matchSpec(e, { kind: 'click', target: 'kind:text:selected' } as GestureSpec, false)).toBe(true);
  });

  it('a chrome target matches a literal affordance: spec, not only a predicate', () => {
    const e = synthesizeInput({ gesture: 'drag', target: 'affordance:rotate-handle', mods: {} });
    expect(matchSpec(e, { kind: 'drag', target: 'affordance:rotate-handle' } as GestureSpec, false)).toBe(true);
  });

  it('produces a drag event that the real matcher matches against a bare drag spec', () => {
    // This is the test that would have caught the fixture bug this task's
    // prompt warns about: a `drag` GestureSpec matches a `pointerdown`
    // InputEvent, not a `kind: 'drag'` event (there is no such arm).
    const e = synthesizeInput({ gesture: 'drag', target: 'empty', mods: {} });
    const spec: GestureSpec = { kind: 'drag' };
    expect(matchSpec(e, spec, false)).toBe(true);
  });
});

describe('isPredicateTarget', () => {
  it('is true for a kindOf predicate', () => {
    expect(isPredicateTarget({ kind: 'drag', target: { kindOf: () => true } })).toBe(true);
  });

  it('is false for string targets and for no target', () => {
    expect(isPredicateTarget({ kind: 'drag', target: 'empty' })).toBe(false);
    expect(isPredicateTarget({ kind: 'drag' })).toBe(false);
  });
});
