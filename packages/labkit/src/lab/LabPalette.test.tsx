import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const Glyph = () => <svg />;
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};
const tools = [
  { id: 'pick', label: 'Pick', icon: Glyph },
  { id: 'pan', label: 'Pan', icon: Glyph },
];

describe('the lab palette', () => {
  it('does not render when the lab declares no tools', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" />);
    expect(screen.queryByRole('toolbar', { name: 'Tools' })).toBeNull();
  });

  it('renders one button per declared tool', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" tools={tools} />);
    expect(screen.getByRole('button', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
  });

  it('marks the chosen tool current after a click', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" tools={tools} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pan' }));
    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-current', 'true');
  });
});
