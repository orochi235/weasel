import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentPage, LabSwitcher } from './LabSwitcher';
import { LabShell } from './LabShell';

const PAGES = [
  { href: '/corpus', label: 'Wall' },
  { href: '/stats', label: 'Dashboard' },
  { href: '/ingest', label: 'Ingestion' },
];

const open = () => fireEvent.click(screen.getByRole('button', { name: /corpus stats/ }));

describe('currentPage', () => {
  it('matches a bare path', () => {
    expect(currentPage('/stats', PAGES)).toBe(1);
  });

  it('survives a query string, a trailing slash and a leftover extension', () => {
    // A dev server maps `/stats` to `stats.html` and serves both spellings, so
    // an old bookmark must still resolve to the same page.
    for (const path of ['/stats?kind=base', '/stats/', '/stats.html',
                        '/lab/stats.html#top']) {
      expect(currentPage(path, PAGES)).toBe(1);
    }
  });

  it('reports -1 for a page that is not one of them', () => {
    expect(currentPage('/bench', PAGES)).toBe(-1);
  });
});

describe('<LabSwitcher>', () => {
  it('shows the title and nothing else until it is opened', () => {
    render(<LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />);
    expect(screen.getByRole('button', { name: /corpus stats/ })).toHaveAttribute(
      'aria-expanded', 'false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens a menu of every lab, the open one included', () => {
    // Filtering the current page out shifts every other entry as you move
    // between pages, so it stays and is marked instead.
    render(<LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />);
    open();
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Wall', 'Dashboard', 'Ingestion']);
    expect(items[1]).toHaveAttribute('aria-current', 'page');
  });

  it('offers real links, so cmd-click and the back button keep working', () => {
    // These are separate documents. A <select> would fire a change event and
    // get none of the three for free.
    render(<LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />);
    open();
    expect(screen.getByRole('menuitem', { name: 'Wall' }).tagName).toBe('A');
    expect(screen.getByRole('menuitem', { name: 'Wall' })).toHaveAttribute(
      'href', '/corpus');
  });

  it('closes on Escape and on a press outside it', () => {
    render(
      <div>
        <LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />
        <button type="button">elsewhere</button>
      </div>);
    open();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    open();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'elsewhere' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays a plain heading when there is nowhere to switch to', () => {
    // A disclosure arrow promising a menu of the page you are already on is
    // worse than no control.
    render(<LabSwitcher title="corpus stats" pages={[PAGES[1]!]} path="/stats" />);
    expect(screen.getByRole('heading', { name: 'corpus stats' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('<LabShell> with pages', () => {
  it('turns its title into the switcher', () => {
    render(<LabShell title="corpus stats" pages={PAGES} path="/stats">body</LabShell>);
    expect(screen.getByRole('button', { name: /corpus stats/ })).toBeInTheDocument();
  });

  it('leaves the title alone when no pages are given', () => {
    render(<LabShell title="corpus stats">body</LabShell>);
    expect(screen.getByRole('heading', { name: 'corpus stats' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /corpus stats/ })).toBeNull();
  });
});
