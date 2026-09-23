import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyPanel } from './PropertyPanel';

const panelOf = (el: HTMLElement) => el.firstElementChild as HTMLElement;

describe('PropertyPanel header actions', () => {
  it('renders actions beside the title, outside the heading', () => {
    render(
      <PropertyPanel title="Dispatch" actions={<button type="button">Clear</button>}>
        body
      </PropertyPanel>,
    );
    const heading = screen.getByRole('heading', { name: 'Dispatch' });
    const action = screen.getByRole('button', { name: 'Clear' });
    expect(heading.contains(action)).toBe(false);
    expect(heading.parentElement).toBe(action.parentElement?.parentElement);
  });

  it('renders actions without a title', () => {
    render(<PropertyPanel actions={<button type="button">Clear</button>}>body</PropertyPanel>);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('renders a bare heading when there are no actions', () => {
    const { container } = render(<PropertyPanel title="T">x</PropertyPanel>);
    expect(panelOf(container).firstElementChild?.tagName).toBe('H2');
  });
});

describe('PropertyPanel selectability', () => {
  it('is chrome by default: no selectable marker', () => {
    const { container } = render(<PropertyPanel title="T">x</PropertyPanel>);
    expect(panelOf(container).hasAttribute('data-selectable')).toBe(false);
  });

  it('marks a panel selectable on request', () => {
    const { container } = render(<PropertyPanel selectable>x</PropertyPanel>);
    expect(panelOf(container).dataset.selectable).toBe('true');
  });

  it('makes a debug panel selectable unless told otherwise', () => {
    const debug = render(<PropertyPanel stance="debug">x</PropertyPanel>);
    expect(panelOf(debug.container).dataset.selectable).toBe('true');
    const off = render(<PropertyPanel stance="debug" selectable={false}>x</PropertyPanel>);
    expect(panelOf(off.container).hasAttribute('data-selectable')).toBe(false);
  });

  // jsdom computes no user-select, so this reads the stylesheet: a proxy for
  // the rule existing and reaching the family's own `none` declarations.
  it('has a rule that lets text select through the whole family', () => {
    const css = readFileSync(resolve(__dirname, 'Properties.module.css'), 'utf8');
    const rule = /\.panel\[data-selectable='true'\],\s*\.panel\[data-selectable='true'\] :is\(\.panel, \.list, \.row, \.group, \.subpanel, \.card, \.cardList\)\s*\{\s*-webkit-user-select: text;\s*user-select: text;/;
    expect(css).toMatch(rule);
  });
});
