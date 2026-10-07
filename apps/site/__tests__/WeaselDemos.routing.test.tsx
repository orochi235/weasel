import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { WeaselDemos } from '../WeaselDemos';
// The views `WeaselDemos` loads lazily, loaded here at collection so their transform is not
// paid inside a test's timeout. `lazy()`'s own import then resolves from the module cache.
import '../Releases';
import '../WhatsNew';

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
  it('falls back to the first demo when the hash names nothing', async () => {
    go('#no-such-demo');
    render(<WeaselDemos />);
    await heading(DEMOS[0].title);
  });

  it('rewrites an unresolvable hash to the demo it settled on', async () => {
    go('#no-such-demo');
    render(<WeaselDemos />);
    await waitFor(() => expect(window.location.hash).toBe(`#${DEMOS[0].id}`));
  });

  it('opens the demo the hash names', async () => {
    const target = DEMOS[3] ?? DEMOS[0];
    go(`#${target.id}`);
    render(<WeaselDemos />);
    await heading(target.title);
  });

  it('opens the releases view on its own id', async () => {
    go('#__releases');
    render(<WeaselDemos />);
    await heading('Releases');
  });

  it("opens what's new on its own id", async () => {
    go('#__whats_new');
    render(<WeaselDemos />);
    await heading(/what's new/i);
    expect(window.location.hash).toBe('#__whats_new');
  });

  it('follows a hashchange after mount, so back and forward work', async () => {
    const target = DEMOS[2] ?? DEMOS[0];
    render(<WeaselDemos />);
    await heading(DEMOS[0].title);
    go(`#${target.id}`);
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await heading(target.title);
  });

  it('leaves a query string alone, since the releases filter lives there', async () => {
    window.history.replaceState(null, '', '/?pkg=core#__releases');
    render(<WeaselDemos />);
    await heading('Releases');
    expect(window.location.search).toBe('?pkg=core');
  });
});

describe('the sidebar', () => {
  it('lists package demos under Packages, by package, and nowhere else', () => {
    render(<WeaselDemos />);
    const nav = screen.getByRole('navigation');
    const packages = within(nav).getByRole('heading', { level: 2, name: 'Packages' }).closest('section')!;
    const audio = within(packages).getByRole('heading', { level: 3, name: 'audio' }).closest('section')!;
    expect(within(audio).getByRole('link', { name: 'Audio' })).toBeTruthy();
    expect(within(nav).getAllByRole('link', { name: 'Audio' })).toHaveLength(1);
  });
});

describe('the source panel', () => {
  it('opens each demo on its first tab, whichever tab the last one was left on', async () => {
    const [first, second] = DEMOS.filter((d) => d.sources.length > 1);
    go(`#${first.id}`);
    render(<WeaselDemos />);
    await heading(first.title);
    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getAllByRole('tab')[1].getAttribute('aria-selected')).toBe('true');
    go(`#${second.id}`);
    act(() => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await heading(second.title);
    expect(screen.getAllByRole('tab')[0].getAttribute('aria-selected')).toBe('true');
  });
});
