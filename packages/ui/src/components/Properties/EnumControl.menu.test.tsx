import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyField } from './PropertyField';

describe('enum field drawn as a menu', () => {
  const options = [
    { value: 'sm', label: <i>Small</i>, short: ['S'] },
    { value: 'lg', label: <i>Large</i> },
  ];

  it('lists an option whose label is not text by its short form, then by its value', () => {
    render(<PropertyField kind="enum" control="menu" label="Size" value={undefined} options={options} onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'), { detail: 1 });
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['S', 'lg']);
  });

  it('names its button by the field and the chosen option in words, for a label that is not text', () => {
    render(<PropertyField kind="enum" control="menu" label="Size" value="sm" options={options} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Size: S' })).toBeInTheDocument();
  });
});
