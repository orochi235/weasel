import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrefGroup, PrefGroupAs } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
const num = (name: string) => ({ kind: 'number' as const, name, description: '', default: 3 });

/** A page holding a section, a page of its own, and, in the section, a page nested a level further and a section
 *  holding one more page. */
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: flag('Show grid'),
        snapping: {
          name: 'Snapping',
          children: {
            enabled: flag('Enabled'),
            wrap: { name: 'Wrapping', as: 'page', children: { atEdge: flag('Wrap at edge') } },
            fine: { name: 'Fine', children: { step: flag('Half steps'), far: { name: 'Far', as: 'page', children: { reach: flag('Reach') } } } },
          },
        },
        guides: { name: 'Guides', as: 'page', children: { smart: flag('Smart guides'), colors: { name: 'Colors', children: { tint: flag('Tint') } } } },
      },
    },
    io: { name: 'Import / Export', children: { author: { kind: 'string', name: 'Author', description: '', default: '' } } },
  },
};

const entry = (path: string) => document.querySelector<HTMLButtonElement>(`[data-pref-rail="${path}"]`)!;
const marks = () => Object.fromEntries(
  [...document.querySelectorAll('[data-rail-mark]')].map((el) => [el.getAttribute('data-pref-rail'), el.getAttribute('data-rail-mark')]),
);

describe('prefRailItems over sections and pages', () => {
  it('lists a page at any depth, a section in between included, and no section', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth])).toEqual([
      ['canvas', 0],
      ['canvas.snapping.wrap', 1],
      ['canvas.snapping.fine.far', 1],
      ['canvas.guides', 1],
      ['io', 0],
    ]);
  });

  it('lists what sits on a page inside sections, however deep, and no section on it', () => {
    const deep: PrefGroup = {
      name: 'Prefs',
      children: { a: { name: 'A', children: { b: { name: 'B', children: { c: { name: 'C', children: {
        d: { name: 'D', children: { on: flag('On') } },
        p: { name: 'P', as: 'page', children: { q: { name: 'Q', children: { r: { name: 'R', children: { on: flag('On') } } } } } },
      } } } } } } },
    };
    expect(prefRailItems(deep).map((i) => [i.path, i.depth])).toEqual([
      ['a', 0],
      ['a.b.c.p', 1],
    ]);
  });

  it('marks a page that only leads to the pages under it, and no page that holds a section', () => {
    const size: PrefGroup = { name: 'Size', children: { cap: num('Cap') } };
    const of = (as?: PrefGroupAs): PrefGroup => ({ name: 'Prefs', children: { cards: { name: 'Cards', children: { size: { ...size, as } } } } });
    expect(prefRailItems(of('page')).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', true], ['cards.size', false]]);
    expect(prefRailItems(of()).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', false]]);
  });
});

describe('PrefsForm rail layout over sections and pages', () => {
  const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" {...props} />);

  it('draws a section on its page and leaves a nested page off it, at any depth', () => {
    renderRail();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Smart guides' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Wrap at edge' })).not.toBeInTheDocument();
  });

  it('opens a nested page from its entry, sections and all', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ onSectionChange });
    await user.click(entry('canvas.guides'));
    expect(onSectionChange).toHaveBeenCalledWith('canvas.guides');
    expect(entry('canvas.guides')).toHaveAttribute('aria-current', 'page');
    expect(entry('canvas')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('checkbox', { name: 'Smart guides' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tint' })).toBeInTheDocument();
    expect(entry('canvas.guides.colors')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).not.toBeInTheDocument();
  });

  it('opens a page nested in a section', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(entry('canvas.snapping.wrap'));
    expect(entry('canvas.snapping.wrap')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Wrap at edge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enabled' })).not.toBeInTheDocument();
  });

  it('draws a section inside a section on its page, and nests a page inside it under the nearest entry above', async () => {
    const user = userEvent.setup();
    renderRail();
    expect(entry('canvas.snapping')).not.toBeInTheDocument();
    expect(entry('canvas.snapping.fine')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Fine' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Half steps' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Reach' })).not.toBeInTheDocument();
    const far = entry('canvas.snapping.fine.far');
    expect(far.parentElement).toBe(entry('canvas.guides').parentElement);

    await user.click(far);
    expect(far).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Reach' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Half steps' })).not.toBeInTheDocument();
  });

  it('folds a page inside a section under the page that holds the section', async () => {
    const user = userEvent.setup();
    renderRail({ foldable: true, defaultSection: 'io' });
    expect(entry('canvas.snapping.fine.far')).not.toBeInTheDocument();
    await user.click(entry('canvas'));
    expect(entry('canvas.snapping.fine.far')).toBeInTheDocument();
    await user.click(entry('canvas.snapping.fine.far'));
    expect(entry('canvas.snapping.fine.far')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Canvas', expanded: true })).toBeInTheDocument();
  });

  it('marks the open page, and nothing else', async () => {
    const user = userEvent.setup();
    renderRail();
    expect(marks()).toEqual({ canvas: 'current' });
    await user.click(entry('canvas.guides'));
    expect(marks()).toEqual({ 'canvas.guides': 'current' });
  });

  it('keeps a panel on its group\'s page, with no entry of its own', () => {
    const boxed: PrefGroup = {
      name: 'Preferences',
      children: { view: { name: 'View', children: { zoom: num('Zoom'), grid: { name: 'Grid', as: 'panel', children: { size: num('Size') } } } } },
    };
    render(<PrefsForm schema={boxed} onChange={() => {}} layout="rail" />);
    expect(screen.queryByRole('button', { name: /Grid/ })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
  });

  it('keeps opening the first page down until one has something of its own', () => {
    const hollow: PrefGroup = {
      name: 'Preferences',
      children: { view: { name: 'View', children: { cards: { name: 'Cards', as: 'page', children: { size: { name: 'Size', as: 'page', children: { cap: num('Cap') } } } } } } },
    };
    render(<PrefsForm schema={hollow} onChange={() => {}} layout="rail" section="view" />);
    expect(screen.getByRole('button', { name: /Size/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });

  it('stays on the page above when the open page\'s group becomes a section of it', () => {
    const size: PrefGroup = { name: 'Size', children: { cap: num('Cap') } };
    const of = (as?: PrefGroupAs): PrefGroup => ({
      name: 'Prefs',
      children: { io: { name: 'IO', children: { on: flag('On') } }, cards: { name: 'Cards', children: { size: { ...size, as } } } },
    });
    const { rerender } = render(<PrefsForm schema={of('page')} onChange={() => {}} layout="rail" defaultSection="cards.size" />);
    expect(screen.getByRole('button', { name: 'Size' })).toHaveAttribute('aria-current', 'page');
    rerender(<PrefsForm schema={of('section')} onChange={() => {}} layout="rail" defaultSection="cards.size" />);
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });
});
