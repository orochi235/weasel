import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PropertyRow } from './PropertyRow';
import { RowScope } from './rowScope';
import { ReadOnly } from '../Disabled';

describe('PropertyRow: the pin on a disabled row', () => {
  it('does nothing when clicked or keyed, and says it is disabled', () => {
    const onAutoChange = vi.fn();
    render(
      <RowScope auto onAutoChange={onAutoChange}>
        <PropertyRow label="Gap" disabled>
          <input aria-label="Gap value" disabled />
        </PropertyRow>
      </RowScope>,
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
      <RowScope auto onAutoChange={onAutoChange}>
        <PropertyRow label="Gap">
          <input aria-label="Gap value" />
        </PropertyRow>
      </RowScope>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pin Gap' }));
    expect(onAutoChange).toHaveBeenCalledWith(false);
  });
});

describe('PropertyRow: the pin on a read-only row', () => {
  it('does nothing when clicked or keyed, and leaves the tab order', () => {
    const onAutoChange = vi.fn();
    render(
      <ReadOnly>
        <RowScope auto onAutoChange={onAutoChange}>
          <PropertyRow label="Gap">
            <input aria-label="Gap value" readOnly />
          </PropertyRow>
        </RowScope>
      </ReadOnly>,
    );
    const pin = screen.getByRole('button', { name: 'Pin Gap' });
    fireEvent.click(pin);
    fireEvent.keyDown(pin, { key: ' ' });
    expect(onAutoChange).not.toHaveBeenCalled();
    expect(pin).not.toHaveAttribute('tabindex', '0');
  });
});
