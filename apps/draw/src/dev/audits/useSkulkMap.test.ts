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

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'hidden');
});

describe('useSkulkMap', () => {
  it('reads a server answering the route with its HTML fallback as no server', async () => {
    serve(() => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    const { result } = renderHook(() => useSkulkMap({ url: URL, everyMs: 60_000, dev: true }));
    await waitFor(() => expect(result.current.status).toBe('no-server'));
  });

  it('keeps the map it had when a later ask finds no server', async () => {
    serve(json, () => new Response('', { status: 404 }));
    const { result } = renderHook(() => useSkulkMap({ url: URL, everyMs: 10, dev: true }));
    await waitFor(() => expect(result.current).toMatchObject({ status: 'ready', error: expect.any(String) }));
  });

  it('asks at once when the page is shown again, though no ask came due while it was hidden', async () => {
    const fetch = serve(json);
    const { result } = renderHook(() => useSkulkMap({ url: URL, everyMs: 60_000, dev: true }));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    setHidden(true);
    setHidden(false);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
