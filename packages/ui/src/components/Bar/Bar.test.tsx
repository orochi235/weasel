import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { ActionsProvider } from '@weasel-js/core';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { icon } from '../../icons.gen';
import { Bar } from './Bar';
import { renderWithIcons } from '../../testing/withIcons';
import { RegisterAction } from '@weasel-js/routing/testing/registerAction';

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

const separators = (root: HTMLElement): number => root.querySelectorAll('[role="separator"]').length;

describe('Bar', () => {
  it("takes what its schema says of `overflow`, under the prop's own word", () => {
    const { rerender } = renderWithIcons(<Bar schema={{ ...schema, overflow: 'menu' }} label="Text" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('data-overflow', 'menu');
    rerender(<Bar schema={{ ...schema, overflow: 'menu' }} overflow="scroll" label="Text" />);
    expect(screen.getByRole('toolbar')).not.toHaveAttribute('data-overflow');
  });

  it('starts its line with its label when its schema leads with it, and not otherwise', () => {
    const { rerender } = renderWithIcons(<Bar schema={{ ...schema, lead: 'label' }} label="Text" />);
    expect(screen.getByRole('toolbar').firstElementChild).toHaveTextContent(/^Text$/);
    rerender(<Bar schema={schema} label="Text" />);
    expect(within(screen.getByRole('toolbar')).queryByText('Text')).toBeNull();
  });

  it('starts its line with its icon when its schema leads with that', () => {
    renderWithIcons(<Bar schema={{ ...schema, lead: 'icon', icon: icon('close') }} label="Text" />);
    const first = screen.getByRole('toolbar').firstElementChild!;
    expect(first.querySelector('svg')).not.toBeNull();
    expect(first).toHaveTextContent(/^$/);
  });

  it("draws a group's icon on the button opening it, as a menu or a popover", () => {
    const more: PrefGroup = { name: 'More', as: 'menu', icon: icon('close'), children: { undo: schema.children.undo! } };
    const spacing = { ...(schema.children.spacing as PrefGroup), icon: icon('close') };
    renderWithIcons(<Bar schema={{ ...schema, children: { more, spacing } }} label="Text" />);
    for (const name of ['More', 'Spacing']) expect(screen.getByRole('button', { name }).querySelector('svg[viewBox="0 0 20 20"]')).not.toBeNull();
  });

  it('draws leaves in their bar forms, in the order the group lists them', () => {
    const { container } = renderWithIcons(<Bar schema={schema} values={{ size: 12 }} label="Text" />);
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
    const { container } = renderWithIcons(<Bar schema={schema} />);
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
    const { container } = renderWithIcons(<Bar schema={{ name: 'B', children: { a: run('A'), b: run('B') } }} />);
    expect(separators(container)).toBe(1);
  });

  it('writes a leaf under a nested group at its dotted path', () => {
    const onChange = vi.fn();
    renderWithIcons(<Bar schema={schema} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(onChange).toHaveBeenCalledWith('style.italic', true);
  });

  it('opens a panel group from a button reading its name, as rows', () => {
    const onChange = vi.fn();
    renderWithIcons(<Bar schema={schema} values={{ 'spacing.leading': 1.5 }} onChange={onChange} />);
    expect(screen.queryByLabelText('Leading')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Spacing' }));
    const field = screen.getByLabelText('Leading');
    fireEvent.change(field, { target: { value: '2' } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith('spacing.leading', 2);
  });

  it('fires an action leaf by key', () => {
    const run = vi.fn();
    renderWithIcons(
      <ActionsProvider>
        <RegisterAction action={{ id: 'edit.undo', label: 'Undo', invoker: { timing: 'immediate', run } }} />
        <Bar schema={schema} />
      </ActionsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('stands a separator across the line it sits on', () => {
    const rule = { kind: 'separator', name: '', description: '', default: undefined } as PrefLeaf;
    const ruled: PrefGroup = { name: 'Tools', children: { a: { kind: 'action', name: 'a', description: '', default: undefined, action: 'edit.a' } as PrefLeaf, rule } };
    const { unmount } = renderWithIcons(<Bar schema={ruled} label="Tools" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
    unmount();
    renderWithIcons(<Bar schema={ruled} orientation="vertical" label="Tools" />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('draws its fields on the bar when vertical, as a horizontal bar does, each stacked', () => {
    renderWithIcons(<Bar schema={schema} values={{ size: 12 }} orientation="vertical" label="Text" />);
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'vertical');
    const size = screen.getByRole('spinbutton', { name: 'Size' });
    expect(size.closest('[data-orientation="vertical"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Size' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });

  it('is no toolbar of its own with no label, for a host that is one', () => {
    renderWithIcons(<Bar schema={schema} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
});
