import { cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresetBar } from './PresetBar';
import { BUILTIN_PRESETS } from './presets';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('<PresetBar>', () => {
  it('says a saved preset is not being kept when the browser refuses to store it', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: () => {},
    });
    renderWithIcons(<PresetBar state={BUILTIN_PRESETS[0]!.state} saved={[]} onSavedChange={() => {}} onLoad={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Preset name' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('status')).toHaveTextContent(/not being kept in the browser/);
  });
});
