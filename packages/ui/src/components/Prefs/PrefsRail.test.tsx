import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrefsForm } from './PrefsForm';
import { filterPrefSubtree, prefRailItems, type PrefGroup } from './schema';

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
});

describe('filterPrefSubtree', () => {
  it('keeps only matching leaves and prunes the groups left empty', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'author');
    expect(Object.keys(filtered?.children ?? {})).toEqual(['io']);
  });

  it('matches a leaf on its description as well as its name', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'alignment');
    const canvas = filtered?.children.canvas as PrefGroup;
    expect(Object.keys(canvas.children)).toEqual(['showGrid']);
  });

  it('keeps every leaf of a group whose own name matches', () => {
    const filtered = filterPrefSubtree(SCHEMA, 'snapping');
    const canvas = filtered?.children.canvas as PrefGroup;
    expect(Object.keys(canvas.children)).toEqual(['snapping']);
    expect(Object.keys((canvas.children.snapping as PrefGroup).children)).toEqual([
      'enabled',
      'wrap',
    ]);
  });

  it('returns the tree unchanged for an empty or blank query', () => {
    expect(filterPrefSubtree(SCHEMA, '')).toBe(SCHEMA);
    expect(filterPrefSubtree(SCHEMA, '   ')).toBe(SCHEMA);
  });

  it('is null when nothing matches', () => {
    expect(filterPrefSubtree(SCHEMA, 'zzz')).toBeNull();
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
