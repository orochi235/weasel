import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabShell } from '../lab/LabShell';
import type { LabChromeContext, LabContribution } from './labTypes';
import { ToolbarRegion } from './regions/ToolbarRegion';

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

describe('lab sidebar region', () => {
  const tree: LabContribution = {
    id: 'tree',
    region: 'sidebar',
    item: { title: 'Stories', body: <p>story list</p> },
  };

  it('renders a section beside the workspace', () => {
    const { container } = render(
      <Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[tree]} />,
    );
    expect(screen.getByText('story list')).toBeInTheDocument();
    expect(container.querySelector('.lk-lab__sidebar')).not.toBeNull();
    expect(screen.getByRole('separator', { name: /lab sidebar/i })).toBeInTheDocument();
  });

  it('folds a section', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[tree]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stories' }));
    expect(screen.queryByText('story list')).toBeNull();
  });

  it('offers no tear-out at lab level', () => {
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[tree]} />);
    expect(screen.queryByRole('button', { name: 'Undock Stories' })).toBeNull();
  });

  it('hands a render contribution the lab context', () => {
    const seen: LabChromeContext[] = [];
    const probe: LabContribution = {
      id: 'probe',
      region: 'sidebar',
      render: (ctx) => {
        seen.push(ctx);
        return <p>probe</p>;
      },
    };
    render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" labChrome={[probe]} />);
    expect(screen.getByText('probe')).toBeInTheDocument();
    expect(seen[0]?.trials).toHaveLength(1);
  });

  it('adds no strip to a lab without sidebar chrome', () => {
    const { container } = render(<Lab title="T" instruments={[bare]} defaultInstrument="Bare" />);
    expect(container.querySelector('.lk-lab__panes')).toBeNull();
  });
});

describe('lab chrome without <Lab>', () => {
  // The rail `apps/theme-editor` mounts: `<LabShell>` with no trial runtime
  // above it, so the context handed to `onActivate` is the consumer's own.
  interface RailCtx {
    undo: () => void;
  }

  it('renders a contribution typed against a consumer context and hands it back', () => {
    const undo = vi.fn();
    const ctx: RailCtx = { undo };
    const rail: readonly LabContribution<RailCtx>[] = [
      {
        id: 'undo',
        region: 'header',
        item: { icon: Glyph, label: 'Undo', showLabel: true, onActivate: (c) => c.undo() },
      },
    ];
    render(
      <LabShell
        title="Palette lab"
        header={
          <ToolbarRegion region="header" label="Lab actions" contributions={rail} ctx={ctx} />
        }
      >
        <div />
      </LabShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
