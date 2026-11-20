import { describe, it, expect } from 'vitest';
import type { RuleCtx } from './types';
import { resolveVisibility } from './resolve';

const CTX = {} as RuleCtx;

describe('resolveVisibility', () => {
  it('shows a consumer id named for an Object.prototype member, which has no rule', () => {
    for (const id of ['constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf']) {
      expect(resolveVisibility(undefined, CTX)(id)).toBe(true);
      expect(resolveVisibility({}, CTX)(id)).toBe(true);
    }
  });
});
