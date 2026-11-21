import { describe, it, expect } from 'vitest';
import { IMPLICIT_TAGS } from '@weasel-js/modes';
import type { RuleCtx, VisibilityRules } from './types';
import { never } from './conditions';
import { resolveVisibility } from './resolve';

const CTX: RuleCtx = {
  focused: false,
  selection: [],
  multiActive: false,
  modifiers: { alt: false, shift: false, meta: false, ctrl: false },
  action: { kind: null, id: null },
  hover: null,
  zoom: 1,
  mode: 'normal',
  allowedCapabilities: new Set(IMPLICIT_TAGS),
};

describe('resolveVisibility', () => {
  it('shows a consumer id named for an Object.prototype member, which has no rule', () => {
    for (const id of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
      expect(resolveVisibility(undefined, CTX)(id)).toBe(true);
      expect(resolveVisibility({}, CTX)(id)).toBe(true);
    }
  });

  it('falls through to the kit default for a rule given as undefined', () => {
    const hide = false;
    const rules: VisibilityRules = {
      'snap.guides': hide ? never : undefined,
      'selection.resize-handles': undefined,
    };
    const kit = resolveVisibility(undefined, CTX);
    const f = resolveVisibility(rules, CTX);
    expect(kit('snap.guides')).toBe(false);
    expect(f('snap.guides')).toBe(false);
    expect(f('selection.resize-handles')).toBe(kit('selection.resize-handles'));
    expect(resolveVisibility({ grid: never }, CTX)('grid')).toBe(false);
  });

  it('keeps a rule for a chrome id spelled __proto__', () => {
    const rules = JSON.parse('{"__proto__": {"any": []}}') as VisibilityRules;
    expect(resolveVisibility(rules, CTX)('__proto__')).toBe(false);
  });
});
