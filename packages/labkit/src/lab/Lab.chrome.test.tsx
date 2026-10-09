import { fireEvent, render, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
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
  it('renders a consumer contribution', async () => {
    const extra: TrialContribution = {
      id: 'export',
      region: 'toolbar',
      item: { icon: Glyph, label: 'Export', onActivate: () => {} },
    };
    await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" chrome={[extra]} />,
    );
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('puts the expand toggle in the trial title bar instead of the tile corner', async () => {
    await renderSettled(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" />);
    expect(screen.queryByRole('button', { name: 'Expand' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expand trial' }));
    expect(document.querySelector('.lk-lightbox--expanded .lk-trial')).not.toBeNull();
  });

  it('suppresses a built-in by id', async () => {
    await renderSettled(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" suppress={['snapshot']} />,
    );
    expect(screen.queryByRole('button', { name: 'Save snapshot' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clone trial' })).toBeInTheDocument();
  });

  it('throws when a consumer id collides with a built-in', async () => {
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

  it('suppresses the view controls before the trial has a view to size them by', async () => {
    const sized: Instrument = {
      ...bare,
      name: 'Sized',
      canvas: {
        layers: [],
        initialView: ({ width }) => ({ zoom: width / 100, pan: { x: 0, y: 0 } }),
      },
    };
    await renderSettled(
      <Lab
        title="T"
        instruments={[sized]}
        defaultInstrument="Sized"
        suppress={['zoom-out', 'zoom-in', 'actual-size', 'zoom-control', 'scale', 'fps']}
      />,
    );
    expect(document.querySelector('.lk-viewport-controls')).toBeNull();
  });

  it('throws when suppressing an id that is not there', async () => {
    silenceRenderError();
    expect(() =>
      render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" suppress={['nope']} />),
    ).toThrow(/cannot suppress "nope"/);
  });

  it('renders an instrument-declared contribution', async () => {
    const withChrome: Instrument = {
      ...bare,
      chrome: [{ id: 'mine', region: 'status', item: { text: 'ready' } }],
    };
    await renderSettled(<Lab title="T" instruments={[withChrome]} defaultInstrument="Bare" />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('renders an aside contribution in its own pane, after the workspace', async () => {
    await renderSettled(
      <Lab
        title="T"
        instruments={[bare]}
        defaultInstrument="Bare"
        labChrome={[{ id: 'notes', region: 'aside', item: { title: 'Notes', body: <p>jot</p> } }]}
      />,
    );
    const body = screen.getByText('jot');
    const trial = screen.getByRole('region', { name: /trial/i });
    expect(body.closest('.lk-lab__aside')).not.toBeNull();
    expect(trial.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('separator', { name: /Lab aside/ })).toBeInTheDocument();
  });
});
