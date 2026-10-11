import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PrefGroup } from '@weasel-js/prefs';
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
        glue: { name: 'Glued', as: 'plain', children: { snap: flag('Snap'), guides: flag('Guides') } },
        rulers: flag('Rulers'),
      },
    },
  },
};

describe('a plain group', () => {
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

  it('gets no rail entry, with or without sub-pages', () => {
    expect(prefRailItems(SCHEMA).map((i) => i.path)).toEqual(['view']);
    expect(prefRailItems(SCHEMA, true).map((i) => i.path)).toEqual(['view']);
  });

  it('at the top level puts its rows on the root\'s own page', () => {
    const top: PrefGroup = {
      name: 'Prefs',
      children: { loose: flag('Loose'), glue: { name: 'Glued', as: 'plain', children: { snap: flag('Snap') } } },
    };
    expect(prefRailItems(top).map((i) => i.path)).toEqual(['']);
    render(<PrefsForm layout="rail" schema={top} values={{}} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual(['Loose', 'Snap']);
  });

  it('is selectable by its path, and reports the row pressed inside it', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <PrefsForm layout="rail" schema={SCHEMA} values={{}} selected="view.glue" onChange={() => {}} onSelect={onSelect} />,
    );
    expect(container.querySelector('[data-pref-path="view.glue"]')).toHaveAttribute('data-selected');
    fireEvent.pointerDown(screen.getByText('Snap'));
    expect(onSelect).toHaveBeenLastCalledWith('view.glue.snap');
  });

  it('draws the same way in the columns layout', () => {
    render(<PrefsForm schema={SCHEMA} values={{}} onChange={() => {}} />);
    expect(screen.queryByText('Glued')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });
});
