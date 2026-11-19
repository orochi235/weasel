import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsSchemaDemo } from '../PrefsSchemaDemo';

afterEach(cleanup);

const row = (path: string) => [...screen.getByRole('rowheader', { name: path }).parentElement!.children].map((c) => c.textContent);

describe('PrefsSchemaDemo', () => {
  it('draws a form from the schema and reads stored values repaired against each leaf', () => {
    render(<PrefsSchemaDemo />);
    expect(screen.getByText('Pressure')).toBeTruthy();
    expect(row('size')).toEqual(['size', '—', '12']);
    fireEvent.click(screen.getByRole('button', { name: 'Store bad values' }));
    expect(row('size')).toEqual(['size', '500', '64']);
    expect(row('shape')).toEqual(['shape', '"triangle"', '"round"']);
    expect(row('name')).toEqual(['name', '"A very long brush name"', '"A very long "']);
  });
});
