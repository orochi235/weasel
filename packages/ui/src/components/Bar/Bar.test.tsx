import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ActionsProvider, useAction, type Action } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar } from './Bar';

const schema: PrefGroup = {
  name: 'Text',
  as: 'bar',
  children: {
    size: { kind: 'number', name: 'Size', description: 'Type size.', default: 12 },
    style: {
      name: 'Style',
      as: 'section',
      children: {
        bold: {
          kind: 'boolean',
          name: 'Bold',
          description: 'Heavier.',
          control: 'toggle',
          pair: { with: 'style.italic', label: 'Style' },
          default: false,
        },
        italic: { kind: 'boolean', name: 'Italic', description: 'Sloped.', control: 'toggle', default: false },
      },
    },
    undo: { kind: 'action', name: 'Undo', description: '', default: undefined, action: 'edit.undo' },
    spacing: {
      name: 'Spacing',
      as: 'panel',
      children: { leading: { kind: 'number', name: 'Leading', description: 'Line spacing.', default: 1.2 } },
    },
  },
};

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

const separators = (root: HTMLElement): number => root.querySelectorAll('[role="separator"]').length;

describe('Bar', () => {
  it('draws leaves in their bar forms, in the order the group lists them', () => {
    const { container } = render(<Bar schema={schema} values={{ size: 12 }} label="Text" />);
    const bar = screen.getByRole('toolbar', { name: 'Text' });
    expect(container.querySelector('[data-bar-label]')).toHaveTextContent('Size');
    const cells = [
      within(bar).getByLabelText('Size'),
      ...['Bold', 'Italic', 'Undo', 'Spacing'].map((name) => within(bar).getByRole('button', { name })),
    ];
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i - 1].compareDocumentPosition(cells[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('sets a nested section apart with a divider on each side, and no heading', () => {
    const { container } = render(<Bar schema={schema} />);
    expect(separators(container)).toBe(2);
    expect(screen.queryByText('Style')).toBeNull();
    const flags = screen.getByRole('group', { name: 'Style' });
    expect(within(flags).getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('puts no divider at either end of the bar, and never two together', () => {
    const run = (name: string): PrefGroup => ({
      name,
      as: 'section',
      children: { on: { kind: 'boolean', name, description: '', default: false } },
    });
    const { container } = render(<Bar schema={{ name: 'B', children: { a: run('A'), b: run('B') } }} />);
    expect(separators(container)).toBe(1);
  });

  it('writes a leaf under a nested group at its dotted path', () => {
    const onChange = vi.fn();
    render(<Bar schema={schema} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(onChange).toHaveBeenCalledWith('style.italic', true);
  });

  it('opens a panel group from a button reading its name, as rows', () => {
    const onChange = vi.fn();
    render(<Bar schema={schema} values={{ 'spacing.leading': 1.5 }} onChange={onChange} />);
    expect(screen.queryByLabelText('Leading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spacing' }));
    const field = screen.getByLabelText('Leading');
    fireEvent.change(field, { target: { value: '2' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('spacing.leading', 2);
  });

  it('fires an action leaf by key', () => {
    const run = vi.fn();
    render(
      <ActionsProvider>
        <Register action={{ id: 'edit.undo', label: 'Undo', invoker: { timing: 'immediate', run } }} />
        <Bar schema={schema} />
      </ActionsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('opens every field from a button when vertical, and keeps actions on the bar', () => {
    render(<Bar schema={schema} values={{ size: 12 }} orientation="vertical" label="Text" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.queryByLabelText('Size')).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Size' }));
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
  });

  it('is no toolbar of its own with no label, for a host that is one', () => {
    render(<Bar schema={schema} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
