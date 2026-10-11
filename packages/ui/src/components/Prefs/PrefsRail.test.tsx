import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: 'Alignment grid.', default: true },
        snapping: {
          name: 'Snapping',
          children: {
            enabled: { kind: 'boolean', name: 'Enabled', description: 'Master toggle.', default: true },
            wrap: {
              name: 'Wrapping',
              children: {
                atEdge: { kind: 'boolean', name: 'Wrap at edge', description: 'Continue from the far side.', default: false },
              },
            },
          },
        },
      },
    },
    io: {
      name: 'Import / Export',
      children: {
        author: { kind: 'string', name: 'Author', description: 'Embedded in exports.', default: '' },
      },
    },
  },
};

describe('prefRailItems', () => {
  it('lists top-level groups with their nested children, and nothing deeper', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth])).toEqual([
      ['canvas', 0],
      ['canvas.snapping', 1],
      ['io', 0],
    ]);
  });

  it('lists every level when asked, each entry followed by its own', () => {
    expect(prefRailItems(SCHEMA, true).map((i) => [i.path, i.depth, i.section])).toEqual([
      ['canvas', 0, 'canvas'],
      ['canvas.snapping', 1, 'canvas'],
      ['canvas.snapping.wrap', 2, 'canvas'],
      ['io', 0, 'io'],
    ]);
  });

  it('names each entry after its group and counts the leaves beneath it', () => {
    const items = prefRailItems(SCHEMA);
    expect(items[0]).toMatchObject({ name: 'Canvas', matches: 3 });
    expect(items[1]).toMatchObject({ name: 'Snapping', matches: 2, section: 'canvas' });
  });

  it('has no entry for loose root leaves when there are none', () => {
    expect(prefRailItems(SCHEMA).some((i) => i.path === '')).toBe(false);
  });

  it('leads with an entry named for the schema when the root has loose leaves', () => {
    const withLoose: PrefGroup = {
      ...SCHEMA,
      children: {
        theme: { kind: 'string', name: 'Theme', description: 'Named theme.', default: 'dark' },
        ...SCHEMA.children,
      },
    };
    const items = prefRailItems(withLoose);
    expect(items[0]).toMatchObject({ path: '', name: 'Preferences', depth: 0, matches: 1 });
  });

  it('names the loose-leaf entry General when the root has no name', () => {
    const unnamed: PrefGroup = {
      name: '',
      children: { theme: { kind: 'string', name: 'Theme', description: 'Named theme.', default: 'dark' } },
    };
    expect(prefRailItems(unnamed)[0]).toMatchObject({ path: '', name: 'General' });
  });
});

describe('PrefsForm rail layout', () => {
  const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
    render(
      <PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" {...props} />,
    );

  it('opens the first group and puts its leaves in the pane', () => {
    renderRail();
    expect(screen.getByRole('button', { name: /Canvas/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Author' })).not.toBeInTheDocument();
  });

  it('renders a group deeper than the rail inside the pane', () => {
    renderRail();
    // `Wrapping` is depth 2: a section in the open pane, never a rail entry.
    expect(screen.getByRole('region', { name: 'Wrapping' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Wrapping/ })).not.toBeInTheDocument();
  });

  it('switches panes when a top-level entry is chosen', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(screen.getByRole('button', { name: /Import \/ Export/ }));
    expect(screen.getByRole('textbox', { name: 'Author' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).not.toBeInTheDocument();
  });

  it('reports the chosen section to a controlled owner without moving on its own', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ section: 'canvas', onSectionChange });
    await user.click(screen.getByRole('button', { name: /Import \/ Export/ }));
    expect(onSectionChange).toHaveBeenCalledWith('io');
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });

  it('opens the first surviving group when a filter takes the open one away', async () => {
    const user = userEvent.setup();
    renderRail({ filterable: true, defaultSection: 'canvas' });
    await user.type(screen.getByRole('textbox', { name: 'Filter Preferences' }), 'author');
    expect(screen.getByRole('button', { name: /Import \/ Export/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('textbox', { name: 'Author' })).toBeInTheDocument();
  });

  it('says so and offers a way back when nothing matches', async () => {
    const user = userEvent.setup();
    renderRail({ filterable: true });
    await user.type(screen.getByRole('textbox', { name: 'Filter Preferences' }), 'zzz');
    expect(screen.getByText(/No settings match/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
  });

  it('falls back to a real group when the owner names one the schema lost', () => {
    renderRail({ section: 'gone' });
    expect(screen.getByRole('button', { name: /Canvas/ })).toHaveAttribute('aria-current', 'page');
  });
});

describe('PrefsForm rail layout with subPages', () => {
  const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
    render(<PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" subPages {...props} />);

  it('gives a top-level entry only its own leaves, not its subgroups', () => {
    renderRail();
    expect(screen.getByRole('checkbox', { name: 'Show grid' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enabled' })).not.toBeInTheDocument();
  });

  it('opens a subentry as its own page, marked as the page', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ onSectionChange });
    await user.click(screen.getByRole('button', { name: /Snapping/ }));
    expect(onSectionChange).toHaveBeenCalledWith('canvas.snapping');
    expect(screen.getByRole('button', { name: /Snapping/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Enabled' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).not.toBeInTheDocument();
  });

  it('gives a group nested deeper an entry and a page of its own', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ onSectionChange, defaultSection: 'canvas.snapping' });
    expect(screen.queryByRole('checkbox', { name: 'Wrap at edge' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Wrapping/ }));
    expect(onSectionChange).toHaveBeenCalledWith('canvas.snapping.wrap');
    expect(screen.getByRole('button', { name: /Wrapping/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Wrap at edge' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Enabled' })).not.toBeInTheDocument();
  });

  it('keeps a panel on its group\'s page, with no entry of its own', () => {
    const boxed: PrefGroup = {
      name: 'Preferences',
      children: {
        view: {
          name: 'View',
          children: {
            zoom: { kind: 'number', name: 'Zoom', description: 'Scale.', default: 1 },
            grid: {
              name: 'Grid',
              as: 'panel',
              children: { size: { kind: 'number', name: 'Size', description: 'Cell size.', default: 8 } },
            },
          },
        },
      },
    };
    render(<PrefsForm schema={boxed} onChange={() => {}} layout="rail" subPages />);
    expect(screen.queryByRole('button', { name: /Grid/ })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
  });

  it('opens the first subentry when a top-level entry has no leaves of its own', () => {
    const bare: PrefGroup = {
      name: 'Preferences',
      children: {
        view: {
          name: 'View',
          children: {
            cards: {
              name: 'Cards',
              children: { cap: { kind: 'number', name: 'Cap', description: 'Tallest card.', default: 3 } },
            },
          },
        },
      },
    };
    render(<PrefsForm schema={bare} onChange={() => {}} layout="rail" subPages section="view" />);
    expect(screen.getByRole('button', { name: /Cards/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });

  it('keeps opening the first entry down until one has something of its own', () => {
    const hollow: PrefGroup = {
      name: 'Preferences',
      children: {
        view: {
          name: 'View',
          children: {
            cards: {
              name: 'Cards',
              children: {
                size: {
                  name: 'Size',
                  children: { cap: { kind: 'number', name: 'Cap', description: 'Tallest card.', default: 3 } },
                },
              },
            },
          },
        },
      },
    };
    render(<PrefsForm schema={hollow} onChange={() => {}} layout="rail" subPages />);
    expect(screen.getByRole('button', { name: /Size/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });

  it('draws a nested section on its parent\'s page, and marks an entry that only leads to the ones under it', () => {
    const cap: PrefGroup = { name: 'Size', children: { cap: { kind: 'number', name: 'Cap', description: '', default: 3 } } };
    const paged: PrefGroup = { name: 'Prefs', children: { cards: { name: 'Cards', children: { size: cap } } } };
    expect(prefRailItems(paged, true).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', true], ['cards.size', false]]);
    const sectioned: PrefGroup = { name: 'Prefs', children: { cards: { name: 'Cards', children: { size: { ...cap, as: 'section' } } } } };
    expect(prefRailItems(sectioned, true).map((i) => [i.path, i.passes ?? false])).toEqual([['cards', false]]);
    render(<PrefsForm schema={sectioned} onChange={() => {}} layout="rail" subPages />);
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });

  it('stays on the page above when the open entry\'s group becomes a section of it', () => {
    const cap: PrefGroup = { name: 'Size', children: { cap: { kind: 'number', name: 'Cap', description: '', default: 3 } } };
    const of = (size: PrefGroup): PrefGroup => ({
      name: 'Prefs',
      children: { io: { name: 'IO', children: { on: { kind: 'boolean', name: 'On', description: '', default: true } } }, cards: { name: 'Cards', children: { size } } },
    });
    const { rerender } = render(<PrefsForm schema={of(cap)} onChange={() => {}} layout="rail" subPages defaultSection="cards.size" />);
    expect(screen.getByRole('button', { name: 'Size' })).toHaveAttribute('aria-current', 'page');
    rerender(<PrefsForm schema={of({ ...cap, as: 'section' })} onChange={() => {}} layout="rail" subPages defaultSection="cards.size" />);
    expect(screen.getByRole('button', { name: 'Cards' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('spinbutton', { name: 'Cap' })).toBeInTheDocument();
  });
});

describe('PrefsForm rail layout, foldable', () => {
  const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
    render(
      <PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" foldable defaultSection="io" {...props} />,
    );
  const snapping = () => screen.queryByRole('button', { name: /^Snapping/ });
  const canvasEntry = () => document.querySelector<HTMLButtonElement>('[data-rail-fold="canvas"]')!;

  it('starts every group shut but the open one', () => {
    renderRail();
    expect(snapping()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Canvas', expanded: false })).toBeInTheDocument();
  });

  it('unfolds a group while it is open, and shuts it again when another opens', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(canvasEntry());
    expect(snapping()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Import/ }));
    expect(snapping()).not.toBeInTheDocument();
  });

  it('folds a nested entry\'s own entries until a page under it is open', async () => {
    const user = userEvent.setup();
    renderRail({ subPages: true });
    const entry = (path: string) => document.querySelector<HTMLButtonElement>(`[data-pref-rail="${path}"]`);
    await user.click(canvasEntry());
    expect(entry('canvas.snapping')).toBeInTheDocument();
    expect(entry('canvas.snapping.wrap')).not.toBeInTheDocument();
    await user.click(entry('canvas.snapping')!);
    await user.click(entry('canvas.snapping.wrap')!);
    expect(entry('canvas.snapping.wrap')).toHaveAttribute('aria-current', 'page');
    await user.click(entry('io')!);
    expect(entry('canvas.snapping')).not.toBeInTheDocument();
  });

  it('folds by its mark without opening the group', async () => {
    const user = userEvent.setup();
    const onSectionChange = vi.fn();
    renderRail({ onSectionChange });
    await user.click(screen.getByRole('button', { name: 'Canvas', expanded: false }));
    expect(snapping()).toBeInTheDocument();
    expect(onSectionChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Canvas', expanded: true }));
    expect(snapping()).not.toBeInTheDocument();
  });

  it('folds and unfolds with Right and Left on the entry', async () => {
    const user = userEvent.setup();
    renderRail();
    canvasEntry().focus();
    await user.keyboard('{ArrowRight}');
    expect(snapping()).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(snapping()).not.toBeInTheDocument();
  });

  it('unfolds everything while filtering', async () => {
    const user = userEvent.setup();
    renderRail({ filterable: true });
    await user.type(screen.getByRole('textbox', { name: 'Filter Preferences' }), 'enabled');
    expect(snapping()).toBeInTheDocument();
  });
});
