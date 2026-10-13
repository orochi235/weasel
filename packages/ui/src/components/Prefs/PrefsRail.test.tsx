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
  it('lists a page, then the sections directly on it, and no section inside one of those', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth, i.page])).toEqual([
      ['canvas', 0, 'canvas'],
      ['canvas.snapping', 1, 'canvas'],
      ['io', 0, 'io'],
    ]);
  });

  it('names each entry after its group and counts the leaves beneath it', () => {
    const items = prefRailItems(SCHEMA);
    expect(items[0]).toMatchObject({ name: 'Canvas', matches: 3 });
    expect(items[1]).toMatchObject({ name: 'Snapping', matches: 2, page: 'canvas' });
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

  it('draws a section nested in a section on the same page, with no entry of its own', () => {
    renderRail();
    expect(screen.getByRole('region', { name: 'Wrapping' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Wrap at edge' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Wrapping/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Snapping/ })).toBeInTheDocument();
  });

  it('switches panes when a top-level entry is chosen', async () => {
    const user = userEvent.setup();
    renderRail();
    await user.click(screen.getByRole('button', { name: /Import \/ Export/ }));
    expect(screen.getByRole('textbox', { name: 'Author' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Show grid' })).not.toBeInTheDocument();
  });

  it('starts a page\'s rows fresh, whatever state a row with the same key held on the last page', async () => {
    const names = (): PrefGroup['children'] => ({
      names: { kind: 'map', name: 'Names', description: '', default: {}, item: { kind: 'string', name: 'Name', description: '', default: '' } },
    });
    const schema: PrefGroup = { name: 'Prefs', children: {
      general: { name: 'General', children: names() },
      export: { name: 'Export', children: names() },
    } };
    const user = userEvent.setup();
    render(<PrefsForm schema={schema} onChange={() => {}} layout="rail" />);
    const halfTyped = () => screen.queryAllByRole('textbox', { name: /key$/ });
    await user.click(screen.getByRole('button', { name: /^Add/ }));
    expect(halfTyped()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Export/ }));
    expect(halfTyped()).toHaveLength(0);
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

describe('PrefsForm rail layout, foldable', () => {
  const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
    render(
      <PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" foldable defaultSection="io" {...props} />,
    );
  const snapping = () => document.querySelector('[data-pref-rail="canvas.snapping"]');
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
    const canvas = SCHEMA.children.canvas as PrefGroup;
    const snapping = canvas.children.snapping as PrefGroup;
    const paged: PrefGroup = { ...SCHEMA, children: { ...SCHEMA.children, canvas: { ...canvas, children: { ...canvas.children,
      snapping: { ...snapping, as: 'page', children: { ...snapping.children, wrap: { ...(snapping.children.wrap as PrefGroup), as: 'page' } } },
    } } } };
    renderRail({ schema: paged });
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
