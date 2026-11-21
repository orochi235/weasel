import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIcons } from '../../testing/withIcons';
import { PropertyControl } from './PropertyField';

const paint = { color: '#3a86ff' };

describe('an inline paint control', () => {
  it('keeps its editor mounted when disabled flips', () => {
    const at = (disabled: boolean) => (
      <PropertyControl kind="paint" control="inline" name="Fill" value={paint} disabled={disabled} onChange={() => {}} />
    );
    const { rerender } = renderWithIcons(at(false));
    const editor = screen.getByRole('radiogroup');
    rerender(at(true));
    expect(document.querySelector('[role=radiogroup]')).toBe(editor);
    rerender(at(false));
    expect(screen.getByRole('radiogroup')).toBe(editor);
  });
});
