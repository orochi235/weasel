import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReloadStore } from '../chunkReload';
import { PageBoundary } from '../PageBoundary';

const memory = (): ReloadStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

function Throws({ error }: { error: Error }): never {
  throw error;
}

const staleChunk = () =>
  new TypeError('Failed to fetch dynamically imported module: https://michaelbaker.tech/weasel/assets/AnnotationCaptureDemo-Bhhd94Cd.js');

// React logs every error a boundary catches; the assertions below are what matter.
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('<PageBoundary>', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('keeps a page that threw from blanking what surrounds it', () => {
    quiet();
    render(
      <div>
        <nav>sidebar</nav>
        <PageBoundary reload={vi.fn()} store={memory()}>
          <Throws error={new Error('boom')} />
        </PageBoundary>
      </div>,
    );
    expect(screen.getByText('sidebar')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('boom');
  });

  it('reloads once for a chunk that failed to load', () => {
    quiet();
    const reload = vi.fn();
    render(
      <PageBoundary reload={reload} store={memory()}>
        <Throws error={staleChunk()} />
      </PageBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the error instead of reloading again when the chunk is still missing', () => {
    quiet();
    const reload = vi.fn();
    const store = memory();
    render(
      <PageBoundary reload={reload} store={store}>
        <Throws error={staleChunk()} />
      </PageBoundary>,
    );
    cleanup();
    render(
      <PageBoundary reload={reload} store={store}>
        <Throws error={staleChunk()} />
      </PageBoundary>,
    );
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('could not load its code');
  });

  it('offers a reload from the error', async () => {
    quiet();
    const reload = vi.fn();
    render(
      <PageBoundary reload={reload} store={undefined}>
        <Throws error={new Error('boom')} />
      </PageBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
