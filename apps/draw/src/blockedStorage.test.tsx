/**
 * A browser with site data blocked throws from the `localStorage` read itself, not only from its methods. Draw boots,
 * and its first-run notice shows, all the same.
 */
import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryAdapter } from '@weasel-js/storage';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { retireLegacyDoc } from './docPersistence';
import { showFirstRunNotice } from './firstRunNotice';
import { importLegacyPrefs, openDrawPrefs } from './prefs';
import { migrateLegacyPanelFlags } from './surfaces/surfaceState';
import { renderWithIcons } from './testIcons';

const blockStorage = () =>
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  });

afterEach(() => {
  vi.restoreAllMocks();
  act(() => defaultToastQueue.clear());
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
