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
