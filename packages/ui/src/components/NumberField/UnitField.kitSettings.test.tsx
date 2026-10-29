import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { UnitField } from './UnitField';
import { REPEAT_DELAY_MS, REPEAT_EVERY_MS } from '@weasel-js/headless';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Host() {
  const [value, setValue] = useState(0);
  return <UnitField value={value} steppers onChange={setValue} aria-label="Count" />;
}

/** The value after the stepper is held through each of `waits` in turn, each its own render. */
function heldFor(settings: KitSettingsOverrides | undefined, ...waits: number[]): string {
  vi.useFakeTimers();
  const host: ReactNode = <Host />;
  render(settings === undefined ? host : <KitSettingsProvider value={settings}>{host}</KitSettingsProvider>);
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Increment' }));
  for (const ms of waits) act(() => { vi.advanceTimersByTime(ms); });
  return (screen.getByRole('spinbutton', { name: 'Count' }) as HTMLInputElement).value;
}

describe('UnitField kit settings', () => {
  it('repeats after the constants with no provider', () => {
    expect(heldFor(undefined, REPEAT_DELAY_MS - 1)).toBe('1');
    cleanup();
    expect(heldFor(undefined, REPEAT_DELAY_MS, REPEAT_EVERY_MS)).toBe('3');
  });

  it("repeats after the provider's numberField.repeatDelayMs, every numberField.repeatEveryMs", () => {
    const settings = { numberField: { repeatDelayMs: 100, repeatEveryMs: 10 } };
    expect(heldFor(settings, 99)).toBe('1');
    cleanup();
    expect(heldFor(settings, 100, 10, 10, 10)).toBe('5');
  });
});
