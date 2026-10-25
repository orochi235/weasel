import { Profiler } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, screen, fireEvent, within } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { RegistryBrowser, type RegistryBrowserPick, type RegistryBrowserProps, type RegistryCategory } from './RegistryBrowser';

afterEach(cleanup);

const CATEGORIES: readonly RegistryCategory[] = [
  {
    id: 'ops',
    label: 'Ops',
    entries: [
      { id: 'rect', label: 'useRectTool' },
      { id: 'ellipse', label: 'useEllipseTool' },
    ],
  },
  { id: 'icons', label: 'Icons', entries: [{ id: 'delete', label: 'Delete' }] },
];

const RECT: RegistryBrowserPick = { category: 'ops', id: 'rect' };
const DELETE: RegistryBrowserPick = { category: 'icons', id: 'delete' };

const item = (name: string | RegExp) => screen.getByRole('treeitem', { name });
const queryItem = (name: string | RegExp) => screen.queryByRole('treeitem', { name });
const filter = (value: string) => fireEvent.change(screen.getByRole('textbox', { name: 'Filter registry' }), { target: { value } });

function browser(over: Partial<RegistryBrowserProps> = {}) {
  return <RegistryBrowser categories={CATEGORIES} selected={null} onSelect={() => {}} detail={null} {...over} />;
}

describe('RegistryBrowser', () => {
  it('renders the categories as collapsed branches of a tree, with their counts', () => {
    renderWithIcons(browser());
    expect(screen.getByRole('tree', { name: 'Registry' })).toBeTruthy();
    expect(item('Ops 2')).toHaveAttribute('aria-expanded', 'false');
    expect(item('Icons 1')).toHaveAttribute('aria-level', '1');
  });

  it('opens the categories named in defaultOpen', () => {
    renderWithIcons(browser({ defaultOpen: ['icons'] }));
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'true');
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands a category on click and shows its entries', () => {
    renderWithIcons(browser());
    fireEvent.click(screen.getByText('Ops'));
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    const group = within(item(/^Ops/)).getByRole('group');
    expect(within(group).getByRole('treeitem', { name: 'useRectTool' })).toHaveAttribute('aria-level', '2');
    expect(within(group).getByRole('treeitem', { name: 'useEllipseTool' })).toBeTruthy();
  });

  it('expands a category from the keyboard', () => {
    renderWithIcons(browser());
    const ops = item(/^Ops/);
    act(() => ops.focus());
    fireEvent.keyDown(ops, { key: 'ArrowRight' });
    expect(ops).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
  });

  it('narrows to the matching entries and opens their categories', () => {
    renderWithIcons(browser());
    filter('rect');
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('useRectTool')).toBeTruthy();
    expect(queryItem('useEllipseTool')).toBeNull();
    expect(queryItem(/^Icons/)).toBeNull();
  });

  it('matches an entry by its extra match text', () => {
    renderWithIcons(browser({ categories: [{ id: 'ops', label: 'Ops', entries: [{ id: 'rect', label: 'useRectTool', match: ['quad'] }] }] }));
    filter('quad');
    expect(item('useRectTool')).toBeTruthy();
  });

  it('keeps categories open while filtering, and restores the unfiltered state after', () => {
    renderWithIcons(browser());
    filter('e');
    fireEvent.click(screen.getByText('Ops'));
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'true');
    filter('');
    expect(item(/^Ops/)).toHaveAttribute('aria-expanded', 'false');
  });

  it('calls onSelect when an entry is clicked, and marks the selected entry', () => {
    const onSelect = vi.fn();
    const { rerender } = renderWithIcons(browser({ onSelect }));
    fireEvent.click(screen.getByText('Ops'));
    fireEvent.click(screen.getByText('useRectTool'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(RECT);
    rerender(browser({ onSelect, selected: RECT }));
    expect(item('useRectTool')).toHaveAttribute('aria-selected', 'true');
    expect(item('useEllipseTool')).toHaveAttribute('aria-selected', 'false');
  });

  it('never commits the selected entry’s category closed', () => {
    const expanded: (string | null)[] = [];
    renderWithIcons(
      <Profiler id="tree" onRender={() => { expanded.push(queryItem(/^Icons/)?.getAttribute('aria-expanded') ?? null); }}>
        {browser({ selected: DELETE })}
      </Profiler>,
    );
    expect(expanded.length).toBeGreaterThan(0);
    expect(expanded.every((v) => v === 'true')).toBe(true);
  });

  it('leaves a collapsed category shut until the selection moves into it again', () => {
    const { rerender } = renderWithIcons(browser({ selected: DELETE }));
    fireEvent.click(screen.getByText('Icons'));
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'false');
    rerender(browser({ selected: { ...DELETE } }));
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'false');
    rerender(browser({ selected: RECT }));
    rerender(browser({ selected: DELETE }));
    expect(item(/^Icons/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows an entry’s trailing content in its row', () => {
    renderWithIcons(browser({
      categories: [{ id: 'ops', label: 'Ops', entries: [{ id: 'rect', label: 'useRectTool', trailing: <span>9</span> }, { id: 'ellipse', label: 'useEllipseTool' }] }],
    }));
    fireEvent.click(screen.getByText('Ops'));
    expect(item('useRectTool 9')).toBeTruthy();
    expect(item('useEllipseTool')).toBeTruthy();
  });

  it('renders the detail beside the tree', () => {
    renderWithIcons(browser({ detail: <p>Entry detail</p> }));
    expect(screen.getByText('Entry detail')).toBeTruthy();
  });
});

describe('RegistryBrowser — grouped categories', () => {
  const grouped: readonly RegistryCategory[] = [
    { id: 'shape', label: 'Shape', group: { id: 'traits', label: 'Traits' }, entries: [{ id: 'rect', label: 'rect' }] },
    { id: 'properties', label: 'Properties', group: { id: 'traits', label: 'Traits' }, entries: [{ id: 'rect', label: 'rect' }] },
  ];

  it('renders the group as a collapsed branch; children hidden by default', () => {
    renderWithIcons(browser({ categories: grouped }));
    expect(item('Traits 2')).toHaveAttribute('aria-expanded', 'false');
    expect(queryItem(/^Shape/)).toBeNull();
    expect(queryItem(/^Properties/)).toBeNull();
  });

  it('expands the group on click and reveals its child categories, still closed', () => {
    renderWithIcons(browser({ categories: grouped }));
    fireEvent.click(screen.getByText('Traits'));
    expect(item(/^Shape/)).toHaveAttribute('aria-level', '2');
    expect(item(/^Properties/)).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('treeitem', { name: 'rect' }).length).toBe(0);
  });

  it('opens the group and the category when an entry inside them is selected', () => {
    renderWithIcons(browser({ categories: grouped, selected: { category: 'properties', id: 'rect' } }));
    expect(item(/^Traits/)).toHaveAttribute('aria-expanded', 'true');
    expect(item(/^Properties/)).toHaveAttribute('aria-expanded', 'true');
    expect(item('rect')).toHaveAttribute('aria-level', '3');
    expect(item('rect')).toHaveAttribute('aria-selected', 'true');
  });
});
