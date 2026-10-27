import { cssColorLiteral } from '@weasel-js/paint';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DefaultMotif, MotifFrame } from './MotifFrame';
import { divider, notch, plaque, rule, stereo, tab, titlebar } from './motifs';
import type { Motif } from './types';

const MOTIFS: readonly [string, () => Motif][] = [
  ['rule', rule],
  ['stereo', () => stereo({ side: 'right' })],
  ['notch', notch],
  ['tab', tab],
  ['plaque', plaque],
  ['titlebar', titlebar],
  ['divider', divider],
];

describe('MotifFrame', () => {
  it.each(MOTIFS)('%s: the root is a group named by its title alone', (id, make) => {
    render(
      <MotifFrame title="Audio" motif={make()} leading={<span>handle</span>} actions={<button type="button">Remove</button>}>
        <p>body</p>
      </MotifFrame>,
    );
    const group = screen.getByRole('group', { name: 'Audio' });
    expect(group).toHaveAttribute('data-motif', id);
    expect(group).toContainElement(screen.getByText('body'));
    expect(group).toContainElement(screen.getByText('handle'));
    expect(group).toContainElement(screen.getByRole('button', { name: 'Remove' }));
  });

  it('draws the rule motif when given none', () => {
    render(<MotifFrame title="Bevel">x</MotifFrame>);
    expect(screen.getByRole('group', { name: 'Bevel' })).toHaveAttribute('data-motif', 'rule');
  });

  it('draws the motif a DefaultMotif above it names, and its own over that', () => {
    render(
      <DefaultMotif group={titlebar()}>
        <MotifFrame title="Bevel">x</MotifFrame>
        <MotifFrame title="Glow" motif={tab()}>
          x
        </MotifFrame>
      </DefaultMotif>,
    );
    expect(screen.getByRole('group', { name: 'Bevel' })).toHaveAttribute('data-motif', 'titlebar');
    expect(screen.getByRole('group', { name: 'Glow' })).toHaveAttribute('data-motif', 'tab');
  });

  it('draws a motif asked for by name from what a DefaultMotif above names, and a name nothing defines as if unset', () => {
    render(
      <DefaultMotif named={{ hero: stereo(), wall: notch() }}>
        <DefaultMotif group={titlebar()} named={{ hero: tab() }}>
          <MotifFrame title="Inner" motif="hero">x</MotifFrame>
          <MotifFrame title="Outer" motif="wall">x</MotifFrame>
          <MotifFrame title="Nobody" motif="nobody">x</MotifFrame>
        </DefaultMotif>
      </DefaultMotif>,
    );
    const motif = (name: string) => screen.getByRole('group', { name }).getAttribute('data-motif');
    expect(motif('Inner')).toBe('tab');
    expect(motif('Outer')).toBe('notch');
    expect(motif('Nobody')).toBe('titlebar');
  });

  it('keeps a default per kind: a group default leaves subpanels in their divider', () => {
    render(
      <DefaultMotif group={titlebar()}>
        <MotifFrame title="Bevel">x</MotifFrame>
        <MotifFrame title="Edge" kind="subpanel">
          x
        </MotifFrame>
        <DefaultMotif subpanel={tab()}>
          <MotifFrame title="Glow">x</MotifFrame>
          <MotifFrame title="Rim" kind="subpanel">
            x
          </MotifFrame>
        </DefaultMotif>
      </DefaultMotif>,
    );
    const motif = (name: string) => screen.getByRole('group', { name }).getAttribute('data-motif');
    expect(motif('Bevel')).toBe('titlebar');
    expect(motif('Edge')).toBe('divider');
    // An inner DefaultMotif that names one kind keeps the outer one's other kind.
    expect(motif('Glow')).toBe('titlebar');
    expect(motif('Rim')).toBe('tab');
  });

  it('cuts the notch title into a fieldset legend', () => {
    render(<MotifFrame title="Wall" motif={notch()}>x</MotifFrame>);
    const group = screen.getByRole('group', { name: 'Wall' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector(':scope > legend')).toHaveTextContent('Wall');
  });

  it('carries stance, grade, emphasis, and tint on the root, as every stanced surface does', () => {
    render(
      <MotifFrame title="Zone" motif={stereo()} stance="clarify" tint={cssColorLiteral('#2b6cb0')}>
        x
      </MotifFrame>,
    );
    const group = screen.getByRole('group', { name: 'Zone' });
    expect(group).toHaveAttribute('data-stance', 'clarify');
    expect(group.style.getPropertyValue('--wzl-tint')).toBe('#2b6cb0');
  });

  it("writes a plaque's mix on its root, beside the tint", () => {
    render(
      <MotifFrame title="View" motif={plaque({ mix: 40 })} tint={cssColorLiteral('#c53030')}>
        x
      </MotifFrame>,
    );
    const group = screen.getByRole('group', { name: 'View' });
    expect(group.style.getPropertyValue('--wzl-plaque-mix')).toBe('40%');
    expect(group.style.getPropertyValue('--wzl-tint')).toBe('#c53030');
  });

  it('renders nothing when hidden', () => {
    const { container } = render(
      <MotifFrame title="Gone" hidden>
        x
      </MotifFrame>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('an inverted stereo frame', () => {
  it('marks itself inverted only when asked', () => {
    const { container, rerender } = render(<MotifFrame title="Fade" motif={stereo({ invert: true })} />);
    expect(container.querySelector('[data-motif="stereo"]')?.hasAttribute('data-invert')).toBe(true);
    rerender(<MotifFrame title="Fade" motif={stereo()} />);
    expect(container.querySelector('[data-motif="stereo"]')?.hasAttribute('data-invert')).toBe(false);
  });

  it.each(MOTIFS)('%s: disabled dims the title and marks the root, and leaves what sits beside the title alone', (_id, make) => {
    render(<MotifFrame title="Glow" motif={make()} disabled inline={<input type="checkbox" aria-label="on" />} />);
    const group = screen.getByRole('group', { name: 'Glow' });
    expect(group).toHaveAttribute('data-disabled');
    // A proxy: the CSS-module proxy answers any key, so this shows only that the title asked to dim.
    expect(screen.getByText('Glow').className).toMatch(/_titleOff_/);
    expect(screen.getByRole('checkbox', { name: 'on' }).closest('[class*="_titleOff_"]')).toBeNull();
  });
});
