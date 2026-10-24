import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DefaultMotif, MotifFrame } from './MotifFrame';
import { divider, notch, plaque, rule, sheet, stereo, tab, titlebar } from './motifs';
import type { Motif } from './types';

const MOTIFS: readonly [string, () => Motif][] = [
  ['rule', rule],
  ['stereo', stereo],
  ['notch', notch],
  ['tab', tab],
  ['plaque', plaque],
  ['titlebar', titlebar],
  ['divider', divider],
  ['sheet', sheet],
];

describe('MotifFrame heading parts', () => {
  it.each(MOTIFS)('%s: draws an inline control beside the title and keeps it out of the name', (_, make) => {
    render(
      <MotifFrame title="Glow" motif={make()} inline={<input type="checkbox" aria-label="Glow on" />} note="How far it spreads.">
        <p>body</p>
      </MotifFrame>,
    );
    const frame = screen.getByRole('group', { name: 'Glow' });
    expect(frame).toContainElement(screen.getByRole('checkbox', { name: 'Glow on' }));
    expect(frame).toContainElement(screen.getByText('How far it spreads.'));
  });

  it.each([
    ['rule', rule],
    ['divider', divider],
    ['sheet', sheet],
  ] as const)('%s: puts the inline control inside its heading, at the level asked for', (_, make) => {
    render(
      <MotifFrame title="Glow" motif={make()} level={5} inline={<input type="checkbox" aria-label="Glow on" />}>
        x
      </MotifFrame>,
    );
    const heading = screen.getByRole('heading', { name: 'Glow', level: 5 });
    expect(within(heading).getByRole('checkbox', { name: 'Glow on' })).toBeInTheDocument();
  });

  it('is a region on request, named by its title', () => {
    render(
      <MotifFrame title="Glow" role="region">
        x
      </MotifFrame>,
    );
    expect(screen.getByRole('region', { name: 'Glow' })).toHaveAttribute('data-motif', 'rule');
  });
});

describe('MotifFrame fallback', () => {
  it('draws its fallback over the built-in motif, and an explicit DefaultMotif over both', () => {
    render(
      <>
        <MotifFrame title="Own" fallback={tab()}>
          x
        </MotifFrame>
        <DefaultMotif group={stereo()}>
          <MotifFrame title="App" fallback={tab()}>
            x
          </MotifFrame>
          <MotifFrame title="Asked" fallback={tab()} motif={notch()}>
            x
          </MotifFrame>
        </DefaultMotif>
      </>,
    );
    const motif = (name: string) => screen.getByRole('group', { name }).getAttribute('data-motif');
    expect(motif('Own')).toBe('tab');
    expect(motif('App')).toBe('stereo');
    expect(motif('Asked')).toBe('notch');
  });
});
