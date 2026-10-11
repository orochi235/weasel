import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { Bar } from './Bar';

afterEach(cleanup);

type Extra = Record<string, unknown>;
const num = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'number', name, description: '', default: 0, ...extra }) as PrefLeaf;
const flag = (name: string, extra: Extra = {}): PrefLeaf =>
  ({ kind: 'boolean', name, description: '', default: false, control: 'toggle', ...extra }) as PrefLeaf;

const on = { path: 'on' };

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    on: flag('On'),
    size: num('Size', { enableIf: on }),
    gone: num('Gone', { showIf: on }),
    go: { kind: 'action', name: 'Go', description: '', default: undefined, run: () => {}, enableIf: on } as PrefLeaf,
    style: { name: 'Style', as: 'section', showIf: on, children: { tight: num('Tight') } },
    faces: { name: 'Faces', as: 'section', enableIf: on, children: { bold: flag('Bold', { pair: { with: 'faces.italic', label: 'Face' } }), italic: flag('Italic') } },
    spacing: { name: 'Spacing', as: 'panel', enableIf: on, children: { leading: num('Leading') } },
    more: { name: 'More', as: 'panel', showIf: on, children: { kern: num('Kern') } },
  },
};

describe('Bar conditions', () => {
  it('draws no cell for a hidden leaf, no run for a hidden section, and no button for a hidden group', () => {
    const { container } = render(<Bar schema={schema} values={{ on: false }} />);
    expect(screen.queryByRole('spinbutton', { name: 'Gone' })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: 'Tight' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(2);
  });

  it('draws them while the condition holds', () => {
    render(<Bar schema={schema} values={{ on: true }} />);
    expect(screen.getByRole('spinbutton', { name: 'Gone' })).toBeEnabled();
    expect(screen.getByRole('spinbutton', { name: 'Tight' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'More' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeEnabled();
  });

  it('disables a cell, an action, and the fused flags of a disabled run', () => {
    render(<Bar schema={schema} values={{ on: false }} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'On' })).toBeEnabled();
  });

  it('opens a disabled group, with its rows disabled', () => {
    render(<Bar schema={schema} values={{ on: false }} />);
    const opener = screen.getByRole('button', { name: 'Spacing' });
    expect(opener).toBeEnabled();
    fireEvent.click(opener);
    const leading = screen.getByRole('spinbutton', { name: 'Leading' });
    expect(leading).toBeDisabled();
    expect(leading.closest('[data-disabled]')).not.toBeNull();
  });

  it('disables the row a vertical bar opens for a leaf', () => {
    render(<Bar schema={schema} values={{ on: false }} orientation="vertical" />);
    fireEvent.click(screen.getByRole('button', { name: 'Size' }));
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeDisabled();
  });
});
