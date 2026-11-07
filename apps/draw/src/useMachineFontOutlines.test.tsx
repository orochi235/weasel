import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawPrefs } from './prefs';
import { useMachineFontOutlines } from './useMachineFontOutlines';

const fonts = vi.hoisted(() => ({
  enabled: false,
  pending: [] as (() => void)[],
}));

vi.mock('./fonts', () => ({
  enableMachineFontOutlines: () => new Promise<readonly string[]>((resolve) => {
    fonts.pending.push(() => { fonts.enabled = true; resolve(['Helvetica']); });
  }),
  disableMachineFontOutlines: () => { fonts.enabled = false; },
}));

afterEach(() => {
  drawPrefs().reset();
  fonts.enabled = false;
  fonts.pending = [];
});

describe('useMachineFontOutlines', () => {
  it('leaves the outlines off when the switch goes off before they finish loading', async () => {
    renderHook(() => useMachineFontOutlines());
    act(() => drawPrefs().set('text.machineFontOutlines', true));
    act(() => drawPrefs().set('text.machineFontOutlines', false));
    await act(async () => { for (const finish of fonts.pending) finish(); });
    expect(fonts.enabled).toBe(false);
  });

  it('keeps the outlines a later switch-on asked for', async () => {
    renderHook(() => useMachineFontOutlines());
    act(() => drawPrefs().set('text.machineFontOutlines', true));
    act(() => drawPrefs().set('text.machineFontOutlines', false));
    act(() => drawPrefs().set('text.machineFontOutlines', true));
    await act(async () => { for (const finish of [...fonts.pending].reverse()) finish(); });
    expect(fonts.enabled).toBe(true);
  });
});
