import { describe, expect, it, vi } from 'vitest';
import { httpThemeApi } from './store';

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('httpThemeApi', () => {
  it('addresses the store under the page base', async () => {
    const fetchImpl = vi.fn(async () => respond(200, { themes: [] }));
    await httpThemeApi('http://localhost:5187/weasel/theme-editor/#/theme', fetchImpl).list();
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5187/weasel/theme-editor/__theme/list', undefined);
  });

  it('sends the definition with the hash it was loaded at, and reads a 409 as a conflict', async () => {
    const fetchImpl = vi.fn(async () => respond(409, { status: 'conflict', hash: 'h2' }));
    const result = await httpThemeApi('http://h/', fetchImpl).put('weasel', { name: 'weasel' }, 'h1');
    expect(result).toEqual({ status: 'conflict', hash: 'h2' });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ definition: { name: 'weasel' }, hash: 'h1' });
  });

  it('throws on a failure the store does not describe', async () => {
    await expect(httpThemeApi('http://h/', async () => respond(500, {})).list()).rejects.toThrow('500');
  });
});
