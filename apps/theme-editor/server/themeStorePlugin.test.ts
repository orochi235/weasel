import { describe, expect, it, vi } from 'vitest';
import type { StoredTheme } from '../src/theme/store';
import type { ThemeStore } from './themeStore';
import { handleThemeRequest } from './themeStorePlugin';

const weasel: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: { name: 'weasel' } };
const fakeStore = (write: ThemeStore['write'] = vi.fn()): ThemeStore => ({
  list: () => [weasel],
  read: (name) => (name === 'weasel' ? weasel : undefined),
  write,
});
const base = '/weasel/theme-editor/__theme';

describe('handleThemeRequest', () => {
  it('ignores every path outside /__theme/<name>', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', '/weasel/theme-editor/index.html', null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/../weasel`, null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/Weasel.json`, null)).toBeUndefined();
  });

  it('lists and reads', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/list`, null)).toEqual({ status: 200, body: { themes: [weasel] } });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/weasel`, null)).toEqual({ status: 200, body: weasel });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/nope`, null)?.status).toBe(404);
  });

  it('answers a conflict with 409 and passes the hash through', () => {
    const write = vi.fn(() => ({ status: 'conflict', hash: 'h2' }) as const);
    const out = handleThemeRequest(fakeStore(write), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' }, hash: 'h1' });
    expect(write).toHaveBeenCalledWith('weasel', { name: 'weasel' }, 'h1');
    expect(out).toEqual({ status: 409, body: { status: 'conflict', hash: 'h2' } });
  });

  it('refuses a body without a definition and a hash', () => {
    expect(handleThemeRequest(fakeStore(), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' } })?.status).toBe(400);
  });
});
