import { describe, expect, it } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/core';
import { reasonLabel } from './reasonLabels';

describe('reasonLabel', () => {
  it('words a known reason, and passes an unknown one through as it is', () => {
    expect(reasonLabel(ActionDisabledReason.SelectionRequired)).toBe('Selection required');
    expect(reasonLabel(ActionDisabledReason.Locked)).toBe('Contains a locked item');
    expect(reasonLabel('archived')).toBe('archived');
  });

  it('reads a reason named like an Object.prototype member as unknown', () => {
    expect(reasonLabel('constructor')).toBe('constructor');
    expect(reasonLabel('toString', { toString: 'Custom' })).toBe('Custom');
  });
});
