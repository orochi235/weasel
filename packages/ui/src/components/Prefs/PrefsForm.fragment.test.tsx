import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
import type { PrefDrop } from './drop';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    view: {
      name: 'View',
      children: {
        grid: flag('Grid'),
        glue: { name: 'Glued', as: 'fragment', children: { snap: flag('Snap'), guides: flag('Guides') } },
        rulers: flag('Rulers'),
      },
    },
  },
};

describe('a fragment group', () => {
  it('draws its rows with no heading, in schema order among its neighbors\'', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} />);
    expect(screen.queryByText('Glued')).toBeNull();
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Grid', 'Snap', 'Guides', 'Rulers',
    ]);
  });

  it('nests its values under its key', () => {
    const onChange = vi.fn();
    render(<PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Snap' }));
    expect(onChange).toHaveBeenCalledWith('view.glue.snap', true);
  });

  it('gets no rail entry', () => {
    expect(prefRailItems(SCHEMA).map((i) => i.path)).toEqual(['view']);
  });

  it('at the top level puts its rows on the root\'s own page', () => {
    const top: PrefGroup = {
      name: 'Prefs',
      children: { loose: flag('Loose'), glue: { name: 'Glued', as: 'fragment', children: { snap: flag('Snap') } } },
    };
    expect(prefRailItems(top).map((i) => i.path)).toEqual(['']);
    render(<PrefsForm layout="rail" schema={top} values={{}} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual(['Loose', 'Snap']);
  });

  it('is selectable by its path, and reports the row pressed inside it', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} selected={['view.glue']} onChange={() => {}} onSelect={onSelect} />,
    );
    expect(container.querySelector('[data-pref-path="view.glue"]')).toHaveAttribute('data-selected');
    fireEvent.pointerDown(screen.getByText('Snap'));
    expect(onSelect).toHaveBeenLastCalledWith('view.glue.snap', { toggle: false });
  });

  it('draws the same way in the columns layout', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} />);
    expect(screen.queryByText('Glued')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('marks the form while a drag is over it, which opens an empty fragment to a drop', () => {
    const empty: PrefGroup = { name: 'Prefs', children: { view: { name: 'View', children: { grid: flag('Grid'), glue: { name: 'Glued', as: 'fragment', children: {} } } } } };
    const form = (drop: PrefDrop | null) => <PrefsForm layout="rail" schema={empty} values={{}} showEmpty drop={drop} onChange={() => {}} />;
    const { container, rerender } = render(form(null));
    const fragment = container.querySelector('[data-pref-fragment]')!;
    expect(fragment).toBeEmptyDOMElement();
    expect(fragment.closest('[data-pref-drag]')).toBeNull();
    rerender(form({ path: '', where: 'home', nodes: [flag('New')], from: [] }));
    expect(container.querySelector('[data-pref-fragment]')!.closest('[data-pref-drag]')).not.toBeNull();
  });
});
