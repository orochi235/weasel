import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ComposeConfig, composeConfig } from './composeConfig';
import { PresetsPanel } from './PresetsPanel';
import { composeSnippet } from './snippet';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the presets panel', () => {
  it('shows the JSX for the badge on the stage, not for the one it copied', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    const before = composeConfig.defaults();
    const after: ComposeConfig = { ...before, look: { ...before.look, label: 'SOMETHING ELSE' } };
    const { rerender } = render(<PresetsPanel config={before} setConfig={() => {}} />, { wrapper: withIcons });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy JSX' }));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Copied to the clipboard.');
    rerender(<PresetsPanel config={after} setConfig={() => {}} />);
    expect(screen.getByRole('textbox', { name: 'Badge JSX' })).toHaveValue(composeSnippet(after));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
