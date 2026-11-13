import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ColorModeProvider, useColorModeControl } from './colorMode';
import { drawPrefs } from './prefs';

afterEach(() => {
  cleanup();
  drawPrefs().reset();
});

let control: ReturnType<typeof useColorModeControl> = null;
function Probe() {
  control = useColorModeControl();
  return null;
}

describe('ColorModeProvider', () => {
  it('reads the color mode from the ui.colorMode pref and writes a choice back to it', () => {
    drawPrefs().set('ui.colorMode', 'light');
    render(<ColorModeProvider>{(mode) => <><output>{mode}</output><Probe /></>}</ColorModeProvider>);
    expect(screen.getByRole('status').textContent).toBe('light');
    act(() => control!.setPreference('dark'));
    expect(drawPrefs().get('ui.colorMode')).toBe('dark');
    expect(screen.getByRole('status').textContent).toBe('dark');
  });
});
