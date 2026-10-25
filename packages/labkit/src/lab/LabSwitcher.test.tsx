import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabShell } from './LabShell';
import { currentPage, LabSwitcher } from './LabSwitcher';

const PAGES = [
  { href: '/corpus', label: 'Wall' },
  { href: '/stats', label: 'Dashboard' },
  { href: '/ingest', label: 'Ingestion' },
];

const open2 = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
const open = () => fireEvent.click(screen.getByRole('button', { name: /corpus stats/ }));

describe('currentPage', () => {
  it('matches a bare path', () => {
    expect(currentPage('/stats', PAGES)).toBe(1);
  });

  it('survives a query string, a trailing slash and a leftover extension', () => {
    // A dev server maps `/stats` to `stats.html` and serves both spellings, so
    // an old bookmark must still resolve to the same page.
    for (const path of ['/stats?kind=base', '/stats/', '/stats.html', '/lab/stats.html#top']) {
      expect(currentPage(path, PAGES)).toBe(1);
    }
  });

  it('reports -1 for a page that is not one of them', () => {
    expect(currentPage('/bench', PAGES)).toBe(-1);
  });

  it('resolves a relative href against the path before comparing', () => {
    const rel = [
      { href: './corpus', label: 'Wall' },
      { href: './effects', label: 'Effects' },
      { href: '../bench', label: 'Bench' },
    ];
    expect(currentPage('/effects', rel)).toBe(1);
    expect(currentPage('/lab/effects?kind=base#top', rel)).toBe(1);
    expect(currentPage('/lab/bench', [{ href: '../bench', label: 'Bench' }])).toBe(0);
    expect(currentPage('/lab/sub/bench', [{ href: '../bench', label: 'Bench' }])).toBe(-1);
    expect(currentPage('/lab/sub/', [{ href: '../bench', label: 'Bench' }])).toBe(-1);
    expect(currentPage('/lab/bench', [{ href: 'sub/../bench', label: 'Bench' }])).toBe(0);
  });

  it('matches an href carrying its own query, and a relative hash route', () => {
    const pages = [
      { href: './corpus?kind=base', label: 'Wall' },
      { href: '../app/#/dev/tools', label: 'Tools' },
    ];
    expect(currentPage('/lab/corpus', pages)).toBe(0);
    expect(currentPage('/lab/app/#/dev/tools', pages)).toBe(1);
    expect(currentPage('/lab/other/#/dev/tools', pages)).toBe(-1);
  });

  it('matches a full URL on this origin and never one on another', () => {
    const here = window.location.origin;
    expect(currentPage('/stats', [{ href: `${here}/stats`, label: 'Dashboard' }])).toBe(0);
    expect(
      currentPage('/stats', [{ href: 'https://elsewhere.invalid/stats', label: 'Away' }]),
    ).toBe(-1);
  });

  // One document serving its pages from the hash: every href shares a path, so
  // only the fragment can tell them apart.
  const ROUTES = [
    { href: '/app/', label: 'App' },
    { href: '#/dev/tools', label: 'Tools' },
    { href: '#/dev/registry', label: 'Registry' },
  ];

  it('tells hash routes on one document apart', () => {
    expect(currentPage('/app/#/dev/registry', ROUTES)).toBe(2);
    expect(currentPage('/app/#/dev/tools', ROUTES)).toBe(1);
  });

  it('matches a hash route through its own query and sub-routes', () => {
    expect(currentPage('/app/#/dev/tools?bundle=minimal', ROUTES)).toBe(1);
    expect(currentPage('/app/#/dev/tools/', ROUTES)).toBe(1);
    expect(currentPage('/app/#/dev/registry/tool/rect', ROUTES)).toBe(2);
    expect(currentPage('/app/#/dev/toolsets', ROUTES)).toBe(0);
  });

  it('falls back to the page without a hash when no route matches', () => {
    expect(currentPage('/app/', ROUTES)).toBe(0);
    expect(currentPage('/app/#/elsewhere', ROUTES)).toBe(0);
  });

  it('reads the hash off the current location by default', () => {
    window.history.replaceState(null, '', '/app/#/dev/registry');
    try {
      render(<LabSwitcher title="Registry" pages={ROUTES} />);
      open2('Registry');
      expect(screen.getByRole('menuitem', { name: 'Registry' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });
});

describe('<LabSwitcher>', () => {
  it('shows the title and nothing else until it is opened', () => {
    render(<LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />);
    expect(screen.getByRole('button', { name: /corpus stats/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
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
    expect(screen.getByRole('menuitem', { name: 'Wall' })).toHaveAttribute('href', '/corpus');
  });

  it('closes on Escape and on a press outside it', () => {
    render(
      <div>
        <LabSwitcher title="corpus stats" pages={PAGES} path="/stats" />
        <button type="button">elsewhere</button>
      </div>,
    );
    open();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();

    open();
    const elsewhere = screen.getByRole('button', { name: 'elsewhere', hidden: true });
    fireEvent.pointerDown(elsewhere, { button: 0 });
    fireEvent.pointerUp(elsewhere, { button: 0 });
    fireEvent.click(elsewhere, { button: 0 });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('stays a plain heading when there is nowhere to switch to', () => {
    // A disclosure arrow promising a menu of the page you are already on is
    // worse than no control.
    render(<LabSwitcher title="corpus stats" pages={PAGES.slice(1, 2)} path="/stats" />);
    expect(screen.getByRole('heading', { name: 'corpus stats' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('<LabShell> with pages', () => {
  it('turns its title into the switcher', () => {
    render(
      <LabShell title="corpus stats" pages={PAGES} path="/stats">
        body
      </LabShell>,
    );
    expect(screen.getByRole('button', { name: /corpus stats/ })).toBeInTheDocument();
  });

  it('leaves the title alone when no pages are given', () => {
    render(<LabShell title="corpus stats">body</LabShell>);
    expect(screen.getByRole('heading', { name: 'corpus stats' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /corpus stats/ })).toBeNull();
  });
});
