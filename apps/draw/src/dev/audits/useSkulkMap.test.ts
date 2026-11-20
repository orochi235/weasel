import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSkulkMap } from './useSkulkMap';
import fixture from './fixture.map.json';

const URL = '/test/__skulk/map';
const json = () => new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });

function serve(...answers: (() => Response)[]) {
  let i = 0;
  const fetch = vi.fn(async () => answers[Math.min(i++, answers.length - 1)]!());
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useSkulkMap', () => {
  it('keeps the map it had when a later ask finds no server', async () => {
    serve(json, () => new Response('', { status: 404 }));
    const { result } = renderHook(() => useSkulkMap({ url: URL, everyMs: 10, dev: true }));
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', error: expect.any(String) }));
  });
});
