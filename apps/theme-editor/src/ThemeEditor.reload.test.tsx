import './labTestSetup';
import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEditor } from './ThemeEditor';
import type { ThemeApi } from './theme/api';
import { loadDraft, persistDraft } from './theme/draftStorage';
import { weasel } from './theme/fixtures';
import type { PutResult, StoredTheme } from '@weasel-js/theme/engine';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

vi.setConfig({ testTimeout: 20_000 });

// Storage that takes a while to take a write, as a slow or contended one does.
vi.mock('./theme/draftStorage', async (actual) => {
  const real = await actual<typeof import('./theme/draftStorage')>();
  return { ...real, clearDraft: (name: string) => new Promise<boolean>((done) => setTimeout(() => void real.clearDraft(name).then(done), 50)) };
});

function stubStorage() {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length() {
      return items.size;
    },
    key: (i: number) => [...items.keys()][i] ?? null,
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    removeItem: (k: string) => void items.delete(k),
  });
}

describe('<ThemeEditor> reload', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens the file, not the discarded draft, when the clear lands late', async () => {
    stubStorage();
    await persistDraft({ definition: { ...weasel, description: 'edited' }, baseHash: 'h1' });
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const api: ThemeApi = {
      list: async () => [stored],
      get: async () => ({ ...stored, hash: 'h9' }),
      put: vi.fn(async () => ({ status: 'conflict', hash: 'h9' }) as PutResult),
    };
    renderWithIcons(<ThemeEditor api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save, with unsaved changes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reload from disk' }));
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    await new Promise((r) => setTimeout(r, 100));
    expect(loadDraft('weasel')).toBeNull();
  });
});
