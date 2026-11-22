import { describe, it, expect, vi } from 'vitest';
import { ActionDisabledReason } from '@weasel-js/routing';
import { createToolResetToDefaultAction } from './toolResetToDefault';

describe('createToolResetToDefaultAction', () => {
  it('is enabled with a target and an activeTool dep', () => {
    const a = createToolResetToDefaultAction(() => 'select');
    expect(a.enabled?.({ activeTool: { setActive: vi.fn() } } as never)).toBe(true);
  });
  it('lets Escape fall through when there is no activeTool dep to switch', () => {
    const a = createToolResetToDefaultAction(() => 'select');
    expect(a.enabled?.({} as never)).toBe(ActionDisabledReason.NotApplicable);
  });
  it('lets Escape fall through when there is nothing to return to', () => {
    const a = createToolResetToDefaultAction(() => null);
    expect(a.enabled?.({ activeTool: { setActive: vi.fn() } } as never)).toBe(ActionDisabledReason.NotApplicable);
  });
});
