import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEditor } from './ThemeEditor';
import type { ThemeApi } from './theme/api';
import { loadDraft, persistDraft } from './theme/draftStorage';
import { weasel } from './theme/fixtures';
import type { PutResult, StoredTheme } from './theme/store';

describe('<ThemeEditor>', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('falls back to the built themes, read-only, when no dev server answers', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    render(<ThemeEditor api={failing} />);
    expect(await screen.findByText('23 of 100 overridden')).toBeInTheDocument();
    expect(failing.put).not.toHaveBeenCalled();
  });

  it('keeps the draft when reloading from disk fails', async () => {
    // Under Node 26 the environment has no working `localStorage`; the draft needs one to be seeded.
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => items.get(k) ?? null,
      setItem: (k: string, v: string) => void items.set(k, v),
      removeItem: (k: string) => void items.delete(k),
    });
    const edited = { ...weasel, description: 'edited' };
    persistDraft({ definition: edited, baseHash: 'h1' });
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const api: ThemeApi = {
      list: async () => [stored],
      get: () => Promise.reject(new Error('503 Service Unavailable')),
      put: vi.fn(async () => ({ status: 'conflict', hash: 'h9' }) as PutResult),
    };
    render(<ThemeEditor api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save, with unsaved changes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reload from disk' }));
    expect(await screen.findByText("Couldn't reload weasel from disk: 503 Service Unavailable")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save, with unsaved changes' })).toBeInTheDocument();
    expect(loadDraft('weasel')?.definition).toEqual(edited);
  });
});
