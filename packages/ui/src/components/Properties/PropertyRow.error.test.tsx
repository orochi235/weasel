import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DialogRow } from './DialogRow';
import { PropertyField } from './PropertyField';
import { PropertyRow } from './PropertyRow';
import s from './Properties.module.css';

describe('a row given an error', () => {
  it('shows it under the control as an alert, and marks the row invalid', () => {
    render(
      <PropertyRow label="Name" error="needs a name">
        <input aria-label="Name" />
      </PropertyRow>,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('needs a name');
    expect(alert.className).toBe(s.rowError);
    const row = alert.parentElement as HTMLElement;
    expect(row).toHaveAttribute('data-invalid');
    expect(row.lastElementChild).toBe(alert);
  });

  it('draws nothing for no error', () => {
    const { container } = render(
      <PropertyRow label="Name">
        <input aria-label="Name" />
      </PropertyRow>,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('[data-invalid]')).toBeNull();
  });

  it('reaches the row from a field and from a dialog row', () => {
    render(
      <>
        <PropertyField kind="number" label="Gap" value={1} onChange={() => {}} error="too small" />
        <PropertyField
          kind="number"
          control="slider"
          label="Blur"
          value={1}
          onChange={() => {}}
          error="too soft"
        />
        <DialogRow label="Globs" summary="a" error="no globs">
          {() => null}
        </DialogRow>
      </>,
    );
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'too small',
      'too soft',
      'no globs',
    ]);
  });
});
