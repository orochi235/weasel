import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_FILTER, type ReleaseIndexEntry } from '@shared/releases';
import type { ReloadStore } from '../chunkReload';
import { PageBoundary } from '../PageBoundary';
import { ReleaseSection } from '../ReleaseSection';

const memory = (): ReloadStore => {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const failing = (error: Error): ReleaseIndexEntry => ({
  version: '1.9.4',
  date: '2026-09-14T00:00:00Z',
  shape: [],
  highlights: [],
  curated: false,
  load: () => Promise.reject(error),
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('a release whose entries fail to load', () => {
  it('hands a missing chunk to the page boundary, which reloads once', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    render(
      <PageBoundary reload={reload} store={memory()}>
        <ReleaseSection
          release={failing(new TypeError('Failed to fetch dynamically imported module: /assets/release-1.9.4.js'))}
          lead
          target={false}
          filter={NO_FILTER}
          onTogglePackage={() => {}}
          onToggleTag={() => {}}
        />
      </PageBoundary>,
    );
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('shows the failure rather than "Loading…" forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { findByRole, queryByText } = render(
      <PageBoundary reload={() => {}} store={memory()}>
        <ReleaseSection
          release={failing(new Error('network down'))}
          lead
          target={false}
          filter={NO_FILTER}
          onTogglePackage={() => {}}
          onToggleTag={() => {}}
        />
      </PageBoundary>,
    );
    expect((await findByRole('alert')).textContent).toContain('network down');
    expect(queryByText('Loading…')).toBeNull();
  });
});
