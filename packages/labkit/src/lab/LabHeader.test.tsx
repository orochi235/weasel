import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const Stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div>stub</div>,
};
const Other: Instrument = { ...Stub, name: 'Other' };

describe('<LabHeader>', () => {
  it('offers an add-trial button when the lab has one instrument', () => {
    render(<Lab instruments={[Stub]} defaultInstrument="Stub" storage={null} />);
    expect(screen.getByRole('button', { name: /add trial/i })).toBeInTheDocument();
  });

  it('offers a picker instead when the lab has several', () => {
    render(<Lab instruments={[Stub, Other]} defaultInstrument="Stub" storage={null} />);
    // A picker, not a button — which instrument to add is now a choice.
    expect(screen.queryByRole('button', { name: /^add trial$/i })).toBeNull();
    expect(screen.getByLabelText(/add trial/i)).toBeInTheDocument();
  });

  it('adds a trial when the button is used', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<Lab instruments={[Stub]} defaultInstrument="Stub" storage={null} />);
    expect(screen.getAllByLabelText(/^Trial Stub$/)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /add trial/i }));
    expect(screen.getAllByLabelText(/^Trial Stub$/)).toHaveLength(2);
  });

  it('exposes the color mode as a three-way choice', () => {
    render(<Lab instruments={[Stub]} defaultInstrument="Stub" storage={null} />);
    for (const label of ['Auto', 'Light', 'Dark']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
    }
  });

  it('draws each color mode as a glyph, with the word only as its name', () => {
    // The assertion above passes whether the segment holds text or an icon,
    // because both routes produce the same accessible name. This is the one
    // that can tell them apart.
    render(<Lab instruments={[Stub]} defaultInstrument="Stub" storage={null} />);
    for (const label of ['Auto', 'Light', 'Dark']) {
      const segment = screen.getByRole('radio', { name: label });
      expect(segment.querySelector('svg')).not.toBeNull();
      expect(segment).toHaveTextContent('');
    }
  });
});
