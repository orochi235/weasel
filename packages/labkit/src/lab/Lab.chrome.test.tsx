import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TrialContribution } from '../chrome/types';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const Glyph = () => <svg />;
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

/** React logs the error it re-throws from a failed render; the assertions are
 *  on the throw itself, so the console noise is not informative. */
function silenceRenderError(): void {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('<Lab> chrome', () => {
  it('renders a consumer contribution', () => {
    const extra: TrialContribution = {
      id: 'export',
      region: 'toolbar',
      item: { icon: Glyph, label: 'Export', onActivate: () => {} },
    };
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[extra]} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('suppresses a built-in by id', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" suppress={['snapshot']} />);
    expect(screen.queryByRole('button', { name: 'Save snapshot' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clone trial' })).toBeInTheDocument();
  });

  it('throws when a consumer id collides with a built-in', () => {
    silenceRenderError();
    const clash: TrialContribution = {
      id: 'clone',
      region: 'toolbar',
      item: { icon: Glyph, label: 'Mine', onActivate: () => {} },
    };
    expect(() =>
      render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[clash]} />),
    ).toThrow(/duplicate contribution id "clone"/);
  });

  it('throws when suppressing an id that is not there', () => {
    silenceRenderError();
    expect(() =>
      render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" suppress={['nope']} />),
    ).toThrow(/cannot suppress "nope"/);
  });

  it('renders an instrument-declared contribution', () => {
    const withChrome: Instrument = {
      ...bare,
      chrome: [{ id: 'mine', region: 'status', item: { text: 'ready' } }],
    };
    render(<Lab title="T" instruments={[withChrome]} defaultInstrument="Bare" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
