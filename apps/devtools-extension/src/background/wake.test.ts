import { describe, expect, it, vi } from 'vitest';
import type { ExtensionApi } from '../browserApi';
import { CONNECT_REQUEST } from '../envelope';
import { wakeTab } from './wake';

function fakeApi({ answers, scriptable = true }: { answers: boolean; scriptable?: boolean }) {
  const calls: string[] = [];
  const api = {
    tabs: {
      sendMessage: vi.fn(async (_tabId: number, message: unknown) => {
        calls.push(message === CONNECT_REQUEST ? 'connect' : 'other');
        if (!answers) throw new Error('Could not establish connection');
        return true;
      }),
    },
    scripting: {
      executeScript: vi.fn(async () => {
        calls.push('inject');
        if (!scriptable) throw new Error('Cannot access a chrome:// URL');
        return [];
      }),
    },
  } as unknown as ExtensionApi;
  return { api, calls };
}

describe('waking a tab', () => {
  it('injects every frame even when one frame’s live script answers, then asks them all to connect', async () => {
    const f = fakeApi({ answers: true });
    await wakeTab(f.api, 4);
    expect(f.api.scripting!.executeScript).toHaveBeenCalledWith({ target: { tabId: 4, allFrames: true }, files: ['content.js'] });
    expect(f.calls).toEqual(['inject', 'connect']);
  });

  it('settles quietly on a page it may not script', async () => {
    const f = fakeApi({ answers: false, scriptable: false });
    await expect(wakeTab(f.api, 4)).resolves.toBeUndefined();
    expect(f.calls).toEqual(['inject', 'connect']);
  });
});
