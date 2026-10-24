import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DefaultMotif, stereo, titlebar } from '../MotifFrame';
import s from './Properties.module.css';
import { Subpanel } from './Subpanel';

describe('Subpanel', () => {
  it('draws in the divider motif, as a group named by its title', () => {
    render(<Subpanel title="Bubbles"><p>rows</p></Subpanel>);
    const group = screen.getByRole('group', { name: 'Bubbles' });
    expect(group).toHaveAttribute('data-motif', 'divider');
    expect(group).toHaveClass(s.subpanel);
  });

  it('takes a motif, and keeps its subpanel class so a list still lays it out', () => {
    render(
      <Subpanel title="Bubbles" motif={stereo()} actions={<button type="button">Reset</button>}>
        <p>rows</p>
      </Subpanel>,
    );
    const group = screen.getByRole('group', { name: 'Bubbles' });
    expect(group).toHaveAttribute('data-motif', 'stereo');
    expect(group).toHaveClass(s.subpanel);
    expect(group).toContainElement(screen.getByRole('button', { name: 'Reset' }));
  });

  it("follows DefaultMotif's subpanel slot and ignores its group slot", () => {
    render(
      <DefaultMotif group={titlebar()}>
        <Subpanel title="Plain">x</Subpanel>
        <DefaultMotif subpanel={stereo()}>
          <Subpanel title="Barred">x</Subpanel>
        </DefaultMotif>
      </DefaultMotif>,
    );
    expect(screen.getByRole('group', { name: 'Plain' })).toHaveAttribute('data-motif', 'divider');
    expect(screen.getByRole('group', { name: 'Barred' })).toHaveAttribute('data-motif', 'stereo');
  });
});
