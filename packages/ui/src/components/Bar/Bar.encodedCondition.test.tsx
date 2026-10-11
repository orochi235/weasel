import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

const italic = { read: (stored: unknown) => stored === 'italic', write: (on: boolean) => (on ? 'italic' : 'normal') };
const schema: PrefGroup = {
  name: 'Text',
  children: {
    slant: { kind: 'boolean', name: 'Italic', description: '', default: false, control: 'toggle', encoding: italic } as PrefLeaf,
    angle: { kind: 'number', name: 'Angle', description: '', default: 12, showIf: { path: 'slant', is: true } } as PrefLeaf,
    weight: { kind: 'number', name: 'Weight', description: '', default: 400, enableIf: { not: { path: 'slant' } } } as PrefLeaf,
  },
};

describe('Bar conditions over an encoded boolean', () => {
  it('compare what the toggle shows, and not the string it stores', () => {
    const { rerender } = render(<Bar schema={schema} values={{ slant: 'italic' }} />);
    expect(screen.getByRole('spinbutton', { name: 'Angle' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Weight' })).toBeDisabled();
    rerender(<Bar schema={schema} values={{ slant: 'normal' }} />);
    expect(screen.queryByRole('spinbutton', { name: 'Angle' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Weight' })).toBeEnabled();
  });
});
