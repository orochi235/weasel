import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PrefGroup } from '@weasel-js/prefs';
import { PrefsForm } from './PrefsForm';
import { prefRailItems } from './schema';

const flag = (name: string) => ({ kind: 'boolean' as const, name, description: '', default: false });

/** A root holding a loose leaf, two sections of its own page with a page between them, and in the first section a
 *  section and a page. */
const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    compact: flag('Compact'),
    tools: {
      name: 'Tools',
      as: 'section',
      children: {
        snap: flag('Snap'),
        fine: { name: 'Fine', children: { half: flag('Half steps') } },
        keys: { name: 'Keys', as: 'page', children: { vim: flag('Vim keys') } },
      },
    },
    canvas: { name: 'Canvas', children: { grid: flag('Show grid') } },
    files: { name: 'Files', as: 'section', children: { backup: flag('Back up') } },
  },
};

/** The same with nothing loose on the root: its page is its sections alone. */
const NO_LOOSE: PrefGroup = { ...SCHEMA, children: Object.fromEntries(Object.entries(SCHEMA.children).filter(([key]) => key !== 'compact')) };

const entry = (path: string) => document.querySelector<HTMLButtonElement>(`[data-pref-rail="${path}"]`)!;
const renderRail = (props: Partial<Parameters<typeof PrefsForm>[0]> = {}) =>
  render(<PrefsForm schema={SCHEMA} onChange={() => {}} layout="rail" {...props} />);

describe('prefRailItems over a section on the root\'s page', () => {
  it('lists no entry for it, and a page inside it under the root\'s entry', () => {
    expect(prefRailItems(SCHEMA).map((i) => [i.path, i.depth])).toEqual([
      ['', 0],
      ['tools.keys', 1],
      ['canvas', 0],
    ]);
  });

  it('gives the root an entry when its page holds sections and no leaf', () => {
    expect(prefRailItems(NO_LOOSE).map((i) => [i.path, i.name, i.depth])).toEqual([
      ['', 'Preferences', 0],
      ['tools.keys', 'Keys', 1],
      ['canvas', 'Canvas', 0],
    ]);
  });

  it('lists no tab, panel, or bar of the root\'s page', () => {
    const root: PrefGroup = {
      name: '',
      children: {
        a: { name: 'A', as: 'panel', children: { on: flag('On') } },
        b: { name: 'B', as: 'tab', children: { on: flag('On') } },
        c: { name: 'C', as: 'bar', children: { on: flag('On') } },
      },
    };
    expect(prefRailItems(root).map((i) => i.path)).toEqual(['']);
  });
});

describe('PrefsForm rail layout over a section on the root\'s page', () => {
  it('draws the section on the root\'s page, and nests a page inside it under the root\'s entry', () => {
    renderRail();
    expect(entry('tools')).toBeNull();
    expect(entry('files')).toBeNull();
    expect(screen.getByRole('region', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Back up' })).toBeInTheDocument();
    expect(entry('tools.keys').parentElement).not.toBe(entry('').parentElement);
    expect(entry('').parentElement).toBe(entry('canvas').parentElement);
  });

  it('leaves a page inside the section off the root\'s page, and opens it from its entry', async () => {
    const user = userEvent.setup();
    renderRail();
    expect(screen.getByRole('checkbox', { name: 'Half steps' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Vim keys' })).not.toBeInTheDocument();
    await user.click(entry('tools.keys'));
    expect(entry('tools.keys')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Vim keys' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Snap' })).not.toBeInTheDocument();
  });

  it('folds a page inside a section of the root\'s page under the root\'s entry', async () => {
    const user = userEvent.setup();
    renderRail({ foldable: true, defaultSection: 'canvas' });
    expect(entry('tools.keys')).toBeNull();
    await user.click(entry(''));
    expect(entry('tools.keys')).toBeInTheDocument();
    await user.click(entry('tools.keys'));
    expect(entry('tools.keys')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Preferences', expanded: true })).toBeInTheDocument();
  });

  it('opens the root\'s page on its sections when nothing is loose on it', () => {
    render(<PrefsForm schema={NO_LOOSE} onChange={() => {}} layout="rail" />);
    expect(entry('')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('checkbox', { name: 'Snap' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Back up' })).toBeInTheDocument();
  });

  it('opens the root\'s page when `section` names a section of it', () => {
    renderRail({ section: 'files' });
    expect(entry('')).toHaveAttribute('aria-current', 'page');
  });
});
