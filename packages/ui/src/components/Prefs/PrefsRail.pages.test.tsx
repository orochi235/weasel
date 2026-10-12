import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrefGroup, PrefGroupAs } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });
const num = (name: string) => ({ kind: 'number' as const, name, description: '', default: 3 });

/** A page holding a section, a page of its own, and, in the section, a page nested a level further. */
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
  it('files each entry on the page that draws it: its own for a page, the one holding it for a section', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth, i.page])).toEqual([
      ['canvas', 0, 'canvas'],
      ['canvas.snapping', 1, 'canvas'],
      ['canvas.snapping.wrap', 2, 'canvas.snapping.wrap'],
      ['canvas.guides', 1, 'canvas.guides'],
      ['canvas.guides.colors', 2, 'canvas.guides'],
      ['io', 0, 'io'],
    ]);
  });

  it('marks a page that only leads to the pages under it, and no page that holds a section', () => {
    const size: PrefGroup = { name: 'Size', children: { cap: num('Cap') } };
    const of = (as?: PrefGroupAs): PrefGroup => ({ name: 'Prefs', children: { cards: { name: 'Cards', children: { size: { ...size, as } } } } });
    expect(prefRailItems(of('page')).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', true], ['cards.size', false]]);
    expect(prefRailItems(of()).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', false], ['cards.size', false]]);
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

  it('scrolls the open page to a section, and opens a page of its own for a nested page', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ onSectionChange });
    await user.click(entry('canvas.snapping'));
    expect(onSectionChange).not.toHaveBeenCalled();
    expect(entry('canvas.snapping')).toHaveAttribute('aria-current', 'location');
    expect(entry('canvas')).toHaveAttribute('aria-current', 'page');

    await user.click(entry('canvas.guides'));
    expect(onSectionChange).toHaveBeenCalledWith('canvas.guides');
    expect(entry('canvas.guides')).toHaveAttribute('aria-current', 'page');
    expect(entry('canvas')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('checkbox', { name: 'Smart guides' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tint' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).not.toBeInTheDocument();
  });

  it('opens a page nested in a section, and the page holding a section chosen from another page', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(entry('canvas.snapping.wrap'));
    expect(entry('canvas.snapping.wrap')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Wrap at edge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enabled' })).not.toBeInTheDocument();

    await user.click(entry('canvas.guides.colors'));
    expect(entry('canvas.guides')).toHaveAttribute('aria-current', 'page');
    expect(entry('canvas.guides.colors')).toHaveAttribute('aria-current', 'location');
  });

  // Which section is in view before one is chosen is the browser's to say: `PrefsRail.marks.browser.test.tsx`.
  it('marks a chosen section current and its page open, and a page with no sections current itself', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(entry('canvas.snapping'));
    expect(marks()).toEqual({ canvas: 'open', 'canvas.snapping': 'current' });
    await user.click(entry('io'));
    expect(marks()).toEqual({ io: 'current' });
  });

  it('folds over both kinds, the mark of a section folded away falling to the entry that holds it', async () => {
    const user = userEvent.setup();
    renderRail({ foldable: true, defaultSection: 'io' });
    expect(entry('canvas.snapping')).not.toBeInTheDocument();
    await user.click(entry('canvas'));
    expect(entry('canvas.snapping')).toBeInTheDocument();
    expect(entry('canvas.guides.colors')).not.toBeInTheDocument();
    await user.click(entry('canvas.guides'));
    await user.click(entry('canvas.guides.colors'));
    expect(marks()).toEqual({ 'canvas.guides': 'open', 'canvas.guides.colors': 'current' });
    await user.click(screen.getByRole('button', { name: 'Guides', expanded: true }));
    expect(entry('canvas.guides.colors')).not.toBeInTheDocument();
    expect(marks()).toEqual({ 'canvas.guides': 'current' });
    await user.click(entry('io'));
    expect(entry('canvas.snapping')).not.toBeInTheDocument();
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
