import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PrefGroup } from '@weasel-js/prefs';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefsForm } from './PrefsForm';
import { prefRailAbove, prefRailItems } from './schema';

afterEach(cleanup);

const flag = (name: string) => ({ kind: 'boolean', name, description: '', default: false }) as const;

const SCHEMA: PrefGroup = {
  name: 'Prefs',
  children: {
    view: { name: 'View', children: {
      grid: flag('Grid'),
      glue: { name: 'Glued', as: 'fragment', children: {
        snap: flag('Snap'),
        rulers: { name: 'Rulers', as: 'section', children: { units: flag('Units') } },
        export: { name: 'Export', as: 'page', children: { pdf: flag('PDF') } },
      } },
    } },
  },
};

describe('a rail over a fragment', () => {
  it('lists a page and a section inside it as its parent\'s', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.page, i.depth])).toEqual([
      ['view', 'view', 0],
      ['view.glue.rulers', 'view', 1],
      ['view.glue.export', 'view.glue.export', 1],
    ]);
  });

  it('draws the page on a page of its own, and not as a section where the fragment sits', () => {
    render(<PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual(['Grid', 'Snap', 'Units']);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual(['PDF']);
  });

  it('names the section for the rail entry that scrolls to it', () => {
    const { container } = render(<PrefsForm layout="rail" schema={SCHEMA} values={{}} onChange={() => {}} />);
    expect(container.querySelector('[data-spy-section="view.glue.rulers"]')).not.toBeNull();
  });

  it('passes a page holding only a fragment of pages on to the first of them', () => {
    const only: PrefGroup = {
      name: 'Prefs',
      children: { view: { name: 'View', children: { glue: { name: '', as: 'fragment', children: {
        export: { name: 'Export', as: 'page', children: { pdf: flag('PDF') } },
      } } } } },
    };
    expect(prefRailItems(only)[0]).toMatchObject({ path: 'view', passes: true });
    render(<PrefsForm layout="rail" schema={only} values={{}} onChange={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'PDF' })).toBeInTheDocument();
  });

  it('nests a page inside a top-level fragment under the root\'s entry', () => {
    const top: PrefGroup = {
      name: 'Prefs',
      children: { loose: flag('Loose'), glue: { name: '', as: 'fragment', children: {
        export: { name: 'Export', as: 'page', children: { pdf: flag('PDF') } },
      } } },
    };
    const items = prefRailItems(top);
    expect(items.map((i) => [i.path, i.depth])).toEqual([['', 0], ['glue.export', 1]]);
    expect(prefRailAbove(items, 'glue.export')).toBe('');
    render(<PrefsForm layout="rail" schema={top} values={{}} onChange={() => {}} />);
    expect(screen.getAllByRole('checkbox').map((el) => el.getAttribute('aria-label'))).toEqual(['Loose']);
  });
});
