import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEditor } from './ThemeEditor';
import type { ThemeApi } from './theme/api';
import { loadDraft, persistDraft, persistLastTheme } from './theme/draftStorage';
import { weasel } from './theme/fixtures';
import { starterDefinition } from './theme/starter';
import type { PutResult, StoredTheme } from '@weasel-js/theme/engine';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';

// Mounting the editor takes up to ~0.7 s a test alone, and blows the 5 s default under a full fleet run.
vi.setConfig({ testTimeout: 20_000 });

// Under Node 26 the environment has no working `localStorage`; a test that seeds a draft needs one.
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

describe('<ThemeEditor>', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('falls back to the built themes, read-only, when no dev server answers', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    renderWithIcons(<ThemeEditor api={failing} />);
    expect(await screen.findByText('23 of 181 overridden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(failing.put).not.toHaveBeenCalled();
  });

  it('starts a new theme as an unsaved draft extending weasel', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    renderWithIcons(<ThemeEditor api={failing} />);
    await userEvent.click(await screen.findByRole('button', { name: 'New theme' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'harbor');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('0 of 13 overridden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save, with unsaved changes' })).toBeEnabled();
  });

  it('refuses a new theme named like one that exists', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    renderWithIcons(<ThemeEditor api={failing} />);
    await userEvent.click(await screen.findByRole('button', { name: 'New theme' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'weasel');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(within(dialog).getByText('weasel already exists.')).toBeInTheDocument();
  });

  it('brings back a new theme that was never saved, from its draft', async () => {
    stubStorage();
    persistDraft({ definition: starterDefinition('harbor'), baseHash: null });
    persistLastTheme('harbor');
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const put = vi.fn(async () => ({ status: 'conflict', hash: null }) as PutResult);
    renderWithIcons(<ThemeEditor api={{ list: async () => [stored], get: vi.fn(), put }} />);
    expect(await screen.findByText('0 of 13 overridden')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    expect(put).toHaveBeenCalledWith('harbor', starterDefinition('harbor'), null);
  });

  it('keeps the draft when reloading from disk fails', async () => {
    stubStorage();
    const edited = { ...weasel, description: 'edited' };
    persistDraft({ definition: edited, baseHash: 'h1' });
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const api: ThemeApi = {
      list: async () => [stored],
      get: () => Promise.reject(new Error('503 Service Unavailable')),
      put: vi.fn(async () => ({ status: 'conflict', hash: 'h9' }) as PutResult),
    };
    renderWithIcons(<ThemeEditor api={api} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save, with unsaved changes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reload from disk' }));
    expect(await screen.findByText("Couldn't reload weasel from disk: 503 Service Unavailable")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save, with unsaved changes' })).toBeInTheDocument();
    expect(loadDraft('weasel')?.definition).toEqual(edited);
  });

  it('lets a never-saved theme whose draft does not derive be discarded, with no file to reload', async () => {
    stubStorage();
    const broken = { ...starterDefinition('harbor'), pins: { fg: '{nope}' } };
    persistDraft({ definition: broken, baseHash: null });
    persistLastTheme('harbor');
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const get = vi.fn(() => Promise.reject(new Error('404 Not Found')));
    renderWithIcons(<ThemeEditor api={{ list: async () => [stored], get, put: vi.fn() }} />);
    expect(await screen.findByText(/harbor does not derive/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Discard this unsaved theme' }));
    expect(await screen.findByText('23 of 181 overridden')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(loadDraft('harbor')).toBeNull();
  });

  it('offers the other themes beside a draft that does not derive', async () => {
    stubStorage();
    persistDraft({ definition: { ...weasel, pins: { ...weasel.pins, fg: '{nope}' } }, baseHash: 'h1' });
    const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
    const other: StoredTheme = { name: 'harbor', hash: 'h2', emits: true, definition: starterDefinition('harbor') };
    renderWithIcons(<ThemeEditor api={{ list: async () => [stored, other], get: vi.fn(), put: vi.fn() }} />);
    expect(await screen.findByText(/weasel does not derive/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Theme/ }));
    await userEvent.click(await screen.findByRole('option', { name: 'harbor' }));
    expect(await screen.findByText('0 of 13 overridden')).toBeInTheDocument();
  });
});
