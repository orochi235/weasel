import { cleanup, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { afterEach, describe, expect, it } from 'vitest';
import { KitSettingsDemo } from '../KitSettingsDemo';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('KitSettingsDemo', () => {
  it("draws both packages' settings in one form, the merged targets group among them", async () => {
    await renderSettled(<KitSettingsDemo />);
    expect(screen.getByRole('spinbutton', { name: 'Typeahead' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Double-click interval' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Curve key' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Selection handle' })).toBeTruthy();
    expect(screen.getByRole('spinbutton', { name: 'Snap reach' })).toBeTruthy();
  });

  it('shows the settings written as custom properties', async () => {
    await renderSettled(<KitSettingsDemo />);
    expect(document.querySelector('pre')?.textContent).toContain('--wzl-kit-tree-typeahead-ms: 500ms;');
  });
});
