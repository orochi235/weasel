import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DefaultMotif, MotifFrame } from './MotifFrame';
import { divider, notch, plaque, rule, sheet, stereo, tab, titlebar, well } from './motifs';
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
  ['well', well],
];

const frameOf = (body: HTMLElement) => body.closest('[data-motif]') as HTMLElement;

describe('an untitled frame', () => {
  it.each(MOTIFS)('%s: draws no heading and no empty bar', (_, make) => {
    render(
      <MotifFrame motif={make()} level={5}>
        <p>body</p>
      </MotifFrame>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(frameOf(screen.getByText('body')).querySelector('legend')).toBeNull();
    const body = screen.getByText('body');
    const strays = [...frameOf(body).querySelectorAll('*')].filter((el) => !el.contains(body));
    expect(strays).toEqual([]);
  });

  it.each(MOTIFS)('%s: draws its inline control with no heading round it', (_, make) => {
    render(
      <MotifFrame motif={make()} inline={<input type="checkbox" aria-label="On" />}>
        <p>body</p>
      </MotifFrame>,
    );
    expect(screen.getByRole('checkbox', { name: 'On' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it.each(MOTIFS)('%s: is not a group named by its controls', (_, make) => {
    render(
      <MotifFrame motif={make()} actions={<button type="button">Remove</button>}>
        <p>body</p>
      </MotifFrame>,
    );
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(screen.queryByRole('group')).toBeNull();
  });
});

describe('heading parts given as false or null', () => {
  it.each(MOTIFS)('%s: draws the same as when they are left out', (_, make) => {
    const { container: given } = render(
      <MotifFrame title="Audio" motif={make()} actions={false} leading={null} inline={false} twisty={null}>
        x
      </MotifFrame>,
    );
    const { container: left } = render(
      <MotifFrame title="Audio" motif={make()}>
        x
      </MotifFrame>,
    );
    const strip = (c: HTMLElement) => c.innerHTML.replace(/id="[^"]*"|aria-labelledby="[^"]*"/g, '');
    expect(strip(given)).toBe(strip(left));
  });
});
