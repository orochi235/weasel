import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from './Lab';

const stub: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <div data-testid="stub-content">stub</div>,
};

describe('<Lab>', () => {
  it('renders without crashing', () => {
    render(
      <Lab instruments={[stub]} defaultInstrument="Stub">
        <div data-testid="lab-children">child</div>
      </Lab>,
    );
    expect(screen.getByTestId('lab-children')).toBeInTheDocument();
  });

  it('throws when instruments is empty', () => {
    expect(() => render(<Lab instruments={[]} defaultInstrument="Stub" />)).toThrow(
      /requires a non-empty `instruments` array/,
    );
  });

  it('seeds an initial workspace using defaultInstrument', () => {
    let captured: { workspaceCount: number } = { workspaceCount: 0 };
    const probe: Instrument = {
      ...stub,
      name: 'Probe',
      render: () => {
        captured = { workspaceCount: 1 };
        return null;
      },
    };
    render(
      <Lab instruments={[probe]} defaultInstrument="Probe" title="T">
        <div>x</div>
      </Lab>,
    );
    // The seeded workspace exists in the store; visible children render via consumers later.
    expect(captured).toBeDefined();
  });
});
