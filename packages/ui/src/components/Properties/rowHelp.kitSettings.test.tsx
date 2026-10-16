import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import { FOCUS_DELAY, useRowHelp } from './rowHelp';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function Row() {
  const cue = useRef<HTMLSpanElement>(null);
  const help = useRowHelp(cue, '.row');
  return (
    <div className="row">
      <span><span ref={cue} /></span>
      <input aria-label="Field" />
      {help.open && <span role="note">help</span>}
    </div>
  );
}

/** Whether the help is open `ms` after focus reaches the row's control. */
function openAfter(settings: KitSettingsOverrides | undefined, ms: number): boolean {
  vi.useFakeTimers();
  render(settings === undefined ? <Row /> : <KitSettingsProvider value={settings}><Row /></KitSettingsProvider>);
  fireEvent.focusIn(screen.getByRole('textbox', { name: 'Field' }));
  act(() => { vi.advanceTimersByTime(ms); });
  return screen.queryByRole('note') !== null;
}

describe('useRowHelp kit settings', () => {
  it('opens after the constant with no provider', () => {
    expect(openAfter(undefined, FOCUS_DELAY - 1)).toBe(false);
    cleanup();
    expect(openAfter(undefined, FOCUS_DELAY)).toBe(true);
  });

  it("opens after the provider's help.focusDelayMs", () => {
    expect(openAfter({ help: { focusDelayMs: 50 } }, 50)).toBe(true);
    cleanup();
    expect(openAfter({ help: { focusDelayMs: 2000 } }, FOCUS_DELAY)).toBe(false);
  });
});
