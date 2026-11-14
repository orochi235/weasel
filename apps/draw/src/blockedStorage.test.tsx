/**
 * A browser with site data blocked throws from the `localStorage` read itself, not only from its methods. Draw boots,
 * and its first-run notice shows, all the same. One without IndexedDB, as some private windows are, keeps draw's
 * session in `localStorage`.
 */
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { DOC_KEY, loadDoc, retireLegacyDoc } from './docPersistence';
import { closeSession, openSession } from './openSession';
import { loadInitial } from './sceneLoading';
import { sessionRecords } from './sessionRecords';
import { showFirstRunNotice } from './firstRunNotice';
import { importLegacyPrefs, openDrawPrefs } from './prefs';
import { migrateLegacyPanelFlags } from './surfaces/surfaceState';
import { renderWithIcons } from './testIcons';

const blockStorage = () =>
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });

afterEach(async () => {
  await closeSession();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  act(() => defaultToastQueue.clear());
});

describe('with IndexedDB unavailable', () => {
  it('keeps the session in localStorage', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'kept.svg' }));
    await expect(openSession()).resolves.toBeUndefined();
    expect(sessionRecords()).toBeUndefined();
    expect(loadDoc().filename).toBe('kept.svg');
    expect(localStorage.getItem(DOC_KEY)).not.toBeNull();
  });

  it('opens, and loads the starter drawing, with localStorage blocked too', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    blockStorage();
    await expect(openSession()).resolves.toBeUndefined();
    expect(loadInitial().some((s) => s.id === 'starter-1')).toBe(true);
  });
});

describe('with localStorage blocked', () => {
  it('folds no legacy prefs or panel flags, and throws nothing', () => {
    blockStorage();
    expect(() => importLegacyPrefs(openDrawPrefs(createMemoryAdapter()))).not.toThrow();
    expect(() => migrateLegacyPanelFlags(openDrawPrefs(createMemoryAdapter()))).not.toThrow();
    expect(() => retireLegacyDoc()).not.toThrow();
  });

  it('still shows the first-run notice', () => {
    renderWithIcons(<ToastRegion />);
    blockStorage();
    act(() => showFirstRunNotice());
    expect(screen.getByText('WeaselDraw is an alpha')).toBeInTheDocument();
  });
});
