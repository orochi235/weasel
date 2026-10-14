import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';

const SCHEMA: PrefGroup = {
  name: 'Tools',
  as: 'bar',
  children: {
    grid: { kind: 'boolean', name: 'Grid', description: '', default: false },
    size: { kind: 'number', name: 'Size', description: '', default: 4 },
  },
};

describe('a PrefsForm over a root drawn as a bar', () => {
  it('is that one bar, whatever layout it is given, with a cell per leaf at its path', () => {
    const { container } = render(<PrefsForm schema={SCHEMA} layout="rail" onChange={() => {}} />);
    const bar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(bar.getAttribute('data-orientation')).toBe('horizontal');
    expect([...container.querySelectorAll('[data-pref-leaf]')].map((el) => el.getAttribute('data-pref-path'))).toEqual(['grid', 'size']);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('runs the way `orientation` says', () => {
    render(<PrefsForm schema={SCHEMA} orientation="vertical" onChange={() => {}} />);
    expect(screen.getByRole('toolbar', { name: 'Tools' }).getAttribute('data-orientation')).toBe('vertical');
  });

  it('writes a cell’s edit at the leaf’s path, and reports a press on a cell', () => {
    const onChange = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(<PrefsForm schema={SCHEMA} onChange={onChange} onSelect={onSelect} />);
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Grid' }));
    expect(onChange).toHaveBeenCalledWith('grid', true);
    fireEvent.pointerDown(container.querySelector('[data-pref-path="size"]')!);
    expect(onSelect).toHaveBeenCalledWith('size', { toggle: false });
  });

  it('draws a drop’s node as a placeholder cell where it would land', () => {
    const { container } = render(
      <PrefsForm schema={SCHEMA} onChange={() => {}}
        drop={{ path: 'size', where: 'before', nodes: [{ kind: 'boolean', name: 'Snap', description: '', default: false }] }} />,
    );
    const cells = [...screen.getByRole('toolbar').children].filter((el) => el.getAttribute('role') !== 'separator');
    expect(cells.map((el) => el.getAttribute('data-pref-path') ?? `placeholder:${el.getAttribute('data-drop-placeholder')}`))
      .toEqual(['grid', 'placeholder:0', 'size']);
    expect(container.querySelector('[data-pref-form]')!.hasAttribute('data-dropping')).toBe(true);
  });

  it('opens what does not fit from a button where the group says `overflow: \'menu\'`, at the root and inside a page', () => {
    const menu: PrefGroup = { ...SCHEMA, overflow: 'menu' };
    const { unmount } = render(<PrefsForm schema={menu} onChange={() => {}} />);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toHaveAttribute('data-overflow', 'menu');
    unmount();
    render(<PrefsForm layout="rail" schema={{ name: '', children: { page: { name: 'Page', children: { tools: menu } } } }} onChange={() => {}} />);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toHaveAttribute('data-overflow', 'menu');
  });

  it('keeps every cell on the line where the group says nothing, and in a form that takes drops', () => {
    const { unmount } = render(<PrefsForm schema={SCHEMA} onChange={() => {}} />);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).not.toHaveAttribute('data-overflow');
    unmount();
    // A cell in the menu is mounted only while it is open, and a drop needs every cell to land beside.
    render(<PrefsForm schema={{ ...SCHEMA, overflow: 'menu' }} drop={null} onChange={() => {}} />);
    expect(screen.getByRole('toolbar', { name: 'Tools' })).not.toHaveAttribute('data-overflow');
  });
});
