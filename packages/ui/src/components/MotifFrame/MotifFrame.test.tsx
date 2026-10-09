import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MotifFrame } from './MotifFrame';
import { notch, plaque, rule, stereo, tab } from './motifs';
import type { Motif } from './types';

const MOTIFS: readonly [string, () => Motif][] = [
  ['rule', rule],
  ['stereo', () => stereo({ side: 'right' })],
  ['notch', notch],
  ['tab', tab],
  ['plaque', plaque],
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

  it('cuts the notch title into a fieldset legend', () => {
    render(<MotifFrame title="Wall" motif={notch()}>x</MotifFrame>);
    const group = screen.getByRole('group', { name: 'Wall' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelector(':scope > legend')).toHaveTextContent('Wall');
  });

  it('carries stance and tone on the root, as every stanced surface does', () => {
    render(
      <MotifFrame title="Zone" motif={stereo()} stance="scope" tone="#2b6cb0">
        x
      </MotifFrame>,
    );
    const group = screen.getByRole('group', { name: 'Zone' });
    expect(group).toHaveAttribute('data-stance', 'scope');
    expect(group.style.getPropertyValue('--wzl-tone')).toBe('#2b6cb0');
  });

  it("writes a plaque's mix on its root, beside the tone", () => {
    render(
      <MotifFrame title="View" motif={plaque({ mix: 40 })} tone="#c53030">
        x
      </MotifFrame>,
    );
    const group = screen.getByRole('group', { name: 'View' });
    expect(group.style.getPropertyValue('--wzl-plaque-mix')).toBe('40%');
    expect(group.style.getPropertyValue('--wzl-tone')).toBe('#c53030');
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
