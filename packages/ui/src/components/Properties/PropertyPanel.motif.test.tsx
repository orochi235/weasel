import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DefaultMotif, titlebar } from '../MotifFrame';
import s from './Properties.module.css';
import { PropertyPanel } from './PropertyPanel';

describe('PropertyPanel motif', () => {
  it('draws in the sheet motif, as a group named by its title', () => {
    render(<PropertyPanel title="Shape">rows</PropertyPanel>);
    const panel = screen.getByRole('group', { name: 'Shape' });
    expect(panel).toHaveAttribute('data-motif', 'sheet');
    expect(panel).toHaveClass(s.panel);
  });

  it('takes a motif and keeps its panel class, which carries its colors in any motif', () => {
    render(
      <PropertyPanel title="Shape" motif={titlebar()} actions={<button type="button">Clear</button>}>
        rows
      </PropertyPanel>,
    );
    const panel = screen.getByRole('group', { name: 'Shape' });
    expect(panel).toHaveAttribute('data-motif', 'titlebar');
    expect(panel).toHaveClass(s.panel);
    expect(panel).toContainElement(screen.getByRole('button', { name: 'Clear' }));
  });

  it("follows DefaultMotif's panel slot and ignores its group slot", () => {
    render(
      <DefaultMotif group={titlebar()}>
        <PropertyPanel title="Plain">x</PropertyPanel>
        <DefaultMotif panel={titlebar()}>
          <PropertyPanel title="Window">x</PropertyPanel>
        </DefaultMotif>
      </DefaultMotif>,
    );
    expect(screen.getByRole('group', { name: 'Plain' })).toHaveAttribute('data-motif', 'sheet');
    expect(screen.getByRole('group', { name: 'Window' })).toHaveAttribute('data-motif', 'titlebar');
  });

  it('is no named group without a title', () => {
    const { container } = render(<PropertyPanel>rows</PropertyPanel>);
    const panel = container.firstElementChild as HTMLElement;
    expect(panel).toHaveAttribute('data-motif', 'sheet');
    expect(panel).not.toHaveAttribute('role');
    expect(panel).not.toHaveAttribute('aria-labelledby');
  });
});
