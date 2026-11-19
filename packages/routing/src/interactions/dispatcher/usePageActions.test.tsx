import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Action } from '../actions/action';
import { ActionDisabledReason } from '../actions/action';
import { usePageActions } from './usePageActions';

const chord = (run: () => void, enabled: () => boolean = () => true): readonly Action[] => [
  {
    id: 'page.save',
    label: 'Save',
    defaultBinding: [{ spec: { kind: 'key', key: 's', mods: { mod: true } } }],
    enabled: () => (enabled() ? true : ActionDisabledReason.NotApplicable),
    invoker: { timing: 'immediate', run },
  },
];

afterEach(() => {
  document.body.replaceChildren();
});

describe('usePageActions', () => {
  it('runs a bound key with no provider above, and claims it', () => {
    const run = vi.fn();
    renderHook(() => usePageActions(chord(run)));
    expect(fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('leaves the key to the page while the action is disabled', () => {
    const run = vi.fn();
    renderHook(() => usePageActions(chord(run, () => false)));
    expect(fireEvent.keyDown(document.body, { key: 's', ctrlKey: true })).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('hears nothing while not enabled, or once unmounted', () => {
    const run = vi.fn();
    const actions = chord(run);
    const { rerender, unmount } = renderHook(({ on }) => usePageActions(actions, on), {
      initialProps: { on: false },
    });
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    rerender({ on: true });
    unmount();
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
    expect(run).not.toHaveBeenCalled();
  });
});
