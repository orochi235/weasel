import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMOS } from '../registry';
import { WeaselDemos } from '../WeaselDemos';

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
// The nav's section labels are `<h2>` too, so scope to the main pane. The
// releases and what's-new views are lazy, hence the generous timeout.
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
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await heading(target.title);
  });

  it('leaves a query string alone, since the releases filter lives there', async () => {
    window.history.replaceState(null, '', '/?pkg=core#__releases');
    render(<WeaselDemos />);
    await heading('Releases');
    expect(window.location.search).toBe('?pkg=core');
  });
});
