/**
 * Scope is the outermost sort key, so an active-scope binding as vague as
 * `{ kind: 'drag' }` beats an ambient-scope binding that names its target
 * precisely. That is why a HUD window wouldn't drag while `rect` was active.
 * An exclusive claim reverses it: only bindings that consult the affordance
 * are candidates at all.
 */
import { describe, expect, it, vi } from 'vitest';
import { matchSorted, type ScopedBinding } from './matcher';
import type { InputEvent } from '@weasel-js/gestures';

const vagueActive: ScopedBinding = {
  binding: { spec: { kind: 'drag' }, actionId: 'insert' },
  scope: 'active',
  ownerToolId: 'rect',
};

const namedAmbient: ScopedBinding = {
  binding: {
    spec: {
      kind: 'drag',
      target: { kindOf: (h: unknown) => (h as { owner?: string })?.owner === 'weasel-hud' },
    },
    actionId: 'hud.drag',
  },
  scope: 'ambient',
  ownerToolId: 'weasel-hud',
};

function dragOn(affordance: unknown): InputEvent {
  return {
    kind: 'pointerdown', x: 0, y: 0, clientX: 0, clientY: 0,
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    affordance,
  } as unknown as InputEvent;
}

const BINDINGS = [vagueActive, namedAmbient];

describe('exclusive claims outrank the scope tier', () => {
  it('lets an exclusive claim reach its owner past a vague active binding', () => {
    const hit = { kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' };
    const sorted = matchSorted(dragOn(hit), BINDINGS, false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['hud.drag']);
  });

  it('leaves shared claims on today’s scope ordering', () => {
    const hit = { kind: 'handle:top-left', owner: 'corner-resize', strength: 'shared' };
    const sorted = matchSorted(dragOn(hit), BINDINGS, false);
    expect(sorted[0]?.binding.actionId).toBe('insert');
  });

  it('leaves unclaimed presses on today’s scope ordering', () => {
    const sorted = matchSorted(dragOn(undefined), BINDINGS, false);
    expect(sorted[0]?.binding.actionId).toBe('insert');
  });

  it('drops a body-only target from contention under an exclusive claim', () => {
    // `target: 'empty'` reads bodyTarget and never sees the affordance, so a
    // marquee must not win a press on chrome floating over empty canvas.
    const bodyOnly: ScopedBinding = {
      binding: { spec: { kind: 'drag', target: 'empty' }, actionId: 'areaSelect' },
      scope: 'active',
      ownerToolId: 'select',
    };
    const e = { ...dragOn({ kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' }), bodyTarget: 'empty' } as unknown as InputEvent;
    const sorted = matchSorted(e, [bodyOnly, namedAmbient], false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['hud.drag']);
  });

  it('admits the `affordance:<kind>` string form, not just predicates', () => {
    const namedByString: ScopedBinding = {
      binding: { spec: { kind: 'drag', target: 'affordance:layer:weasel-hud' }, actionId: 'hud.drag' },
      scope: 'ambient',
      ownerToolId: 'weasel-hud',
    };
    const hit = { kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' };
    const sorted = matchSorted(dragOn(hit), [vagueActive, namedByString], false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['hud.drag']);
  });

  it('keeps scope ordering among the survivors', () => {
    // Ambient is listed first, so registration order would put it first; scope
    // ordering inside the filtered set is what makes the active binding win.
    const activeConsulting: ScopedBinding = {
      binding: { spec: { kind: 'drag', target: 'affordance:layer:weasel-hud' }, actionId: 'tool.onHud' },
      scope: 'active',
      ownerToolId: 'rect',
    };
    const hit = { kind: 'layer:weasel-hud', owner: 'weasel-hud', strength: 'exclusive' };
    const sorted = matchSorted(dragOn(hit), [namedAmbient, activeConsulting], false);
    expect(sorted.map(m => m.binding.actionId)).toEqual(['tool.onHud', 'hud.drag']);
  });

  it('returns nothing when no binding consults the affordance', () => {
    const hit = { kind: 'layer:no-taker', owner: 'no-taker', strength: 'exclusive' };
    expect(matchSorted(dragOn(hit), [vagueActive], false, undefined, () => {})).toEqual([]);
  });
});

describe('an exclusive claim no binding can receive warns in dev', () => {
  it('names the owner, once per owner', () => {
    const warn = vi.fn();
    const hit = { kind: 'layer:silent-widget', owner: 'silent-widget', strength: 'exclusive' };
    matchSorted(dragOn(hit), [vagueActive], false, undefined, warn);
    matchSorted(dragOn(hit), [vagueActive], false, undefined, warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('exclusive claim by "silent-widget"');
  });

  it('stays silent for a shared claim', () => {
    const warn = vi.fn();
    const hit = { kind: 'layer:quiet-widget', owner: 'quiet-widget', strength: 'shared' };
    matchSorted(dragOn(hit), [vagueActive], false, undefined, warn);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stays silent when there were no bindings to begin with', () => {
    const warn = vi.fn();
    const hit = { kind: 'layer:empty-set', owner: 'empty-set', strength: 'exclusive' };
    matchSorted(dragOn(hit), [], false, undefined, warn);
    expect(warn).not.toHaveBeenCalled();
  });
});
