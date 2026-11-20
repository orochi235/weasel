import { afterEach, describe, expect, it, vi } from 'vitest';

async function enabledWith(flag: string): Promise<(ns?: string) => boolean> {
  localStorage.setItem('weasel.debug', flag);
  vi.resetModules();
  return (await import('./dlog')).isDebugEnabled;
}

afterEach(() => { localStorage.removeItem('weasel.debug'); });

describe('isDebugEnabled', () => {
  it('turns on only the namespaces a list names', async () => {
    const on = await enabledWith('tools,selection');
    expect(on('tools')).toBe(true);
    expect(on('history')).toBe(false);
  });

  it('turns on every namespace when a list holds `*`', async () => {
    const on = await enabledWith('tools, *');
    expect(on('history')).toBe(true);
  });
});
