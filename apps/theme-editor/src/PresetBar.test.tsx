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
  it('says a saved preset is not being kept when the browser refuses to store it', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
      removeItem: () => {},
    });
    renderWithIcons(<PresetBar state={BUILTIN_PRESETS[0]!.state} saved={[]} onSavedChange={() => {}} onLoad={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Preset name' }), { target: { value: 'mine' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/not being kept in the browser/);
  });

  it('holds Save on a built-in preset name, and says why', () => {
    const onSavedChange = vi.fn();
    const builtin = BUILTIN_PRESETS[0]!.name;
    renderWithIcons(<PresetBar state={BUILTIN_PRESETS[0]!.state} saved={[]} onSavedChange={onSavedChange} onLoad={() => {}} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Preset name' }), { target: { value: ` ${builtin} ` } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByText(`${builtin} is a built-in preset: give this one another name.`)).toBeInTheDocument();
  });
});
