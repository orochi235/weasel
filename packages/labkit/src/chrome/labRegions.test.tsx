import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import type { LabChromeContext, LabContribution } from './labTypes';

const Glyph = () => <svg />;
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

function silenceRenderError(): void {
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

describe('lab-level chrome', () => {
  it('renders a header contribution beside the lab header', () => {
    const contribution: LabContribution = {
      id: 'publish',
      region: 'header',
      item: { icon: Glyph, label: 'Publish', onActivate: () => {} },
    };
    render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[contribution]} />,
    );
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
  });

  it('hands a header contribution the lab, not a trial', () => {
    const contribution: LabContribution = {
      id: 'another',
      region: 'header',
      item: {
        icon: Glyph,
        label: 'Another',
        onActivate: (ctx) => ctx.addTrial('Bare'),
      },
    };
    render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[contribution]} />,
    );
    expect(screen.getAllByLabelText(/^Trial /)).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Another' }));
    expect(screen.getAllByLabelText(/^Trial /)).toHaveLength(2);
  });

  it('renders a palette contribution in the lab rail and selects it', () => {
    const contribution: LabContribution = {
      id: 'measure',
      region: 'palette',
      item: { icon: Glyph, label: 'Measure' },
    };
    render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[contribution]} />,
    );
    const button = screen.getByRole('button', { name: 'Measure' });
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: 'Measure' })).toHaveAttribute('aria-current', 'true');
  });

  it('gives a palette contribution the whole lab context, not a tool slot alone', () => {
    // The shape the `as unknown as TrialChromeContext` cast used to fake: a
    // contribution reading anything past the tool slot got `undefined`.
    const seen: LabChromeContext[] = [];
    const contribution: LabContribution = {
      id: 'readout',
      region: 'palette',
      render: (ctx) => {
        seen.push(ctx);
        return <span>{`${ctx.trials.length} trial(s), mode ${ctx.mode}`}</span>;
      },
    };
    render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[contribution]} />,
    );
    expect(screen.getByText('1 trial(s), mode auto')).toBeInTheDocument();
    expect(seen[0]?.activeToolId).toBeNull();
    expect(typeof seen[0]?.saveSnapshot).toBe('function');
  });

  it('renders a footer contribution', () => {
    const contribution: LabContribution = {
      id: 'count',
      region: 'footer',
      item: { text: 'idle' },
    };
    render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[contribution]} />,
    );
    expect(screen.getByText('idle')).toBeInTheDocument();
  });

  it('throws when two lab contributions share an id', () => {
    silenceRenderError();
    const clash: LabContribution[] = [
      { id: 'same', region: 'header', item: { icon: Glyph, label: 'One', onActivate: () => {} } },
      { id: 'same', region: 'footer', item: { text: 'two' } },
    ];
    expect(() =>
      render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={clash} />),
    ).toThrow(/duplicate contribution id "same"/);
  });

  it('keeps the lab tool slot and lab palette contributions in one namespace', () => {
    silenceRenderError();
    const clash: LabContribution = {
      id: 'pick',
      region: 'palette',
      item: { icon: Glyph, label: 'Mine' },
    };
    expect(() =>
      render(
        <Lab
          title="T"
          instruments={[bare]}
          defaultInstrument="Bare"
          tools={[{ id: 'pick', label: 'Pick', icon: Glyph }]}
          labChrome={[clash]}
        />,
      ),
    ).toThrow(/duplicate contribution id "pick"/);
  });
});
