import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyRow } from './PropertyRow';

describe('PropertyRow: the pin on a disabled row', () => {
  it('does nothing when clicked or keyed, and says it is disabled', () => {
    const onAutoChange = vi.fn();
    render(
      <PropertyRow label="Gap" auto onAutoChange={onAutoChange} disabled>
        <input aria-label="Gap value" disabled />
      </PropertyRow>,
    );
    const pin = screen.getByRole('button', { name: 'Pin Gap' });
    fireEvent.click(pin);
    fireEvent.keyDown(pin, { key: 'Enter' });
    expect(onAutoChange).not.toHaveBeenCalled();
    expect(pin).toHaveAttribute('aria-disabled', 'true');
    expect(pin).not.toHaveAttribute('tabindex', '0');
  });

  it('still pins on a row that is not disabled', () => {
    const onAutoChange = vi.fn();
    render(
      <PropertyRow label="Gap" auto onAutoChange={onAutoChange}>
        <input aria-label="Gap value" />
      </PropertyRow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(onAutoChange).toHaveBeenCalledWith(false);
  });
});
