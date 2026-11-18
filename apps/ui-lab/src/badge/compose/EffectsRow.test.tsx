import '../../labTestSetup';
import { fireEvent, screen } from '@testing-library/react';
import type { LeafRenderer } from '@weasel-js/labkit';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it, vi } from 'vitest';
import { addEffect } from '../effects';
import { effectsRenderer } from './EffectsRow';

type RowContext = Parameters<LeafRenderer>[0];

describe('the effects row', () => {
  it('takes no edit while its row is disabled', () => {
    const setValue = vi.fn();
    const ctx = { value: addEffect([], 'shadow'), setValue, disabled: true } as unknown as RowContext;
    renderWithIcons(<>{effectsRenderer(ctx)}</>);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Shadow' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Run Shadow' }));
    expect(setValue).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Add effect/ })).toBeDisabled();
  });
});
