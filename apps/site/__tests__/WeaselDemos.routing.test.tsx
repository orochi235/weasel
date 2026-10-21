import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACKAGES } from '../Packages/catalog';
import { DEMOS } from '../registry';
import { App } from '../App';
import { WeaselDemos } from '../WeaselDemos';
// The views `WeaselDemos` loads lazily, loaded here at collection so their transform is not
// paid inside a test's timeout. `lazy()`'s own import then resolves from the module cache.
import '../Releases';
import '../WhatsNew';
import '../FrontPage/GetStarted';
import '../Shell';
import { renderWithIcons } from '../testIcons';

// The real history renders ~46,000 elements, which a `getByRole` then walks; under a loaded
// fleet run that alone outlasted the 5 s wait. Routing needs only the heading.
vi.mock('virtual:changelogs', () => ({
  default: [{ version: '1.0.0', date: '2026-08-12T00:00:00Z', entries: [{ id: 'a', packages: ['core'], titleHtml: 'a change', bodyHtml: '', level: 'patch' }] }],
}));

// jsdom has no IntersectionObserver, and `WeaselDemos` builds one to defer
// work until a demo scrolls into view. Without this the page boundary catches
// the ReferenceError and every assertion below reads an error screen.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    },
  );
});

// The whole app renders here. Demos load lazily, so what these assert is the
// chrome the router drives — the heading and the hash — not a demo's canvas.
// The nav's section labels are `<h2>` too, so scope to the main pane.
const heading = async (text: string | RegExp) =>
  waitFor(
    () => expect(within(screen.getByRole('main')).getByRole('heading', { level: 2, name: text })).toBeTruthy(),
    { timeout: 5000 },
  );

const go = (hash: string) => window.history.replaceState(null, '', `/${hash}`);

beforeEach(() => go(''));
afterEach(cleanup);

describe('the hash router', () => {
  it('shows the front page, and no sidebar, when there is no hash', () => {
    renderWithIcons(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'weasel' })).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('shows the front page when the hash names nothing, and drops the hash', async () => {
    go('?pkg=core#no-such-demo');
    renderWithIcons(<App />);
    expect(await screen.findByRole('link', { name: /get started/i })).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?pkg=core');
  });

  it('opens the first demo from the front page\'s Demos link', async () => {
    renderWithIcons(<App />);
    go('#__demos');
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await heading(DEMOS[0].title);
    await waitFor(() => expect(window.location.hash).toBe(`#${DEMOS[0].id}`));
  });

  it('opens get started on its own id', async () => {
    go('#__get_started');
    renderWithIcons(<WeaselDemos />);
    await heading('Get started');
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 2, name: 'Install' })).toBeTruthy();
  });

  it('returns to the front page from the sidebar wordmark', async () => {
    go(`#${DEMOS[0].id}`);
    renderWithIcons(<App />);
    fireEvent.click(await screen.findByRole('link', { name: 'weasel home' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'weasel' })).toBeTruthy();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(window.location.hash).toBe('');
  });

  it('opens the demo the hash names', async () => {
    const target = DEMOS[3] ?? DEMOS[0];
    go(`#${target.id}`);
    renderWithIcons(<WeaselDemos />);
    await heading(target.title);
  });

  it('opens the releases view on its own id', async () => {
    go('#__releases');
    renderWithIcons(<WeaselDemos />);
    await heading('Releases');
  });

  it('opens demo updates on its own id', async () => {
    go('#__whats_new');
    renderWithIcons(<WeaselDemos />);
    await heading(/demo updates/i);
    expect(window.location.hash).toBe('#__whats_new');
  });

  it('follows a hashchange after mount, so back and forward work', async () => {
    const target = DEMOS[2] ?? DEMOS[0];
    go(`#${DEMOS[0].id}`);
    renderWithIcons(<WeaselDemos />);
    await heading(DEMOS[0].title);
    go(`#${target.id}`);
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await heading(target.title);
  });

  it('leaves a query string alone, since the releases filter lives there', async () => {
    window.history.replaceState(null, '', '/?pkg=core#__releases');
    renderWithIcons(<WeaselDemos />);
    await heading('Releases');
    expect(window.location.search).toBe('?pkg=core');
  });
});

describe('the sidebar', () => {
  it('lists package demos under Packages, by package, and nowhere else', () => {
    go(`#${DEMOS[0].id}`);
    renderWithIcons(<WeaselDemos />);
    const nav = screen.getByRole('navigation');
    const packages = within(nav).getByRole('heading', { level: 2, name: 'Packages' }).closest('section')!;
    const audio = within(packages).getByRole('heading', { level: 3, name: 'audio' }).closest('section')!;
    expect(within(audio).getByRole('link', { name: 'Audio' })).toBeTruthy();
    expect(within(nav).getAllByRole('link', { name: 'Audio' })).toHaveLength(1);
  });

  it('lists every published package, linked to its page, those with no demos included', () => {
    go(`#${DEMOS[0].id}`);
    renderWithIcons(<WeaselDemos />);
    const packages = within(screen.getByRole('navigation')).getByRole('heading', { level: 2, name: 'Packages' }).closest('section')!;
    const listed = within(packages).getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(listed).toEqual(expect.arrayContaining(PACKAGES.map((pkg) => pkg.name)));
    const bare = PACKAGES.find((pkg) => !DEMOS.some((d) => d.package === pkg.name))!;
    expect(within(packages).getByRole('link', { name: bare.name }).getAttribute('href')).toBe(`#pkg/${bare.name}`);
  });
});

describe('sidebar navigation', () => {
  it('adds a history entry per demo opened, so Back returns to the one before', async () => {
    const [first, second, third] = DEMOS;
    go(`#${first.id}`);
    renderWithIcons(<WeaselDemos />);
    await heading(first.title);
    const before = window.history.length;
    const nav = screen.getByRole('navigation');

    fireEvent.click(within(nav).getByRole('link', { name: second.title }));
    await heading(second.title);
    expect(window.location.hash).toBe(`#${second.id}`);
    fireEvent.click(within(nav).getByRole('link', { name: third.title }));
    await heading(third.title);
    expect(window.history.length).toBe(before + 2);

    fireEvent.click(within(nav).getByRole('link', { name: third.title }));
    expect(window.history.length).toBe(before + 2);
  });
});

describe('the source panel', () => {
  it('opens each demo on its first tab, whichever tab the last one was left on', async () => {
    const [first, second] = DEMOS.filter((d) => d.sources.length > 1);
    go(`#${first.id}`);
    renderWithIcons(<WeaselDemos />);
    await heading(first.title);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    go(`#${second.id}`);
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await heading(second.title);
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
  });

  it('is a tab set the keyboard can work: arrows move between files, and each tab names its panel', async () => {
    const [first] = DEMOS.filter((d) => d.sources.length > 1);
    go(`#${first.id}`);
    renderWithIcons(<WeaselDemos />);
    await heading(first.title);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((t) => t.tabIndex === 0)).toHaveLength(1);
    act(() => tabs[0].focus());
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-controls')).toBe(panel.id);
  });
});
