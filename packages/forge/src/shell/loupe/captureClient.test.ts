import { expect, it, vi } from 'vitest';
import { createCaptureClient } from './captureClient';
import { payload } from './pixels.fixture';

const answering = (status: number, body: string) =>
  (async () => new Response(body, { status, headers: { 'Content-Type': 'text/html' } })) as typeof fetch;

it('answers null, and says captures are unavailable, for a 503 whose body is not JSON', async () => {
  const client = createCaptureClient('/', answering(503, '<h1>Service Unavailable</h1>'));
  await expect(client.take(payload('s'))).resolves.toBeNull();
  expect(client.status()).toBe('captures are unavailable');
});

it("takes a 503's reason as its status", async () => {
  const client = createCaptureClient('/', answering(503, JSON.stringify({ reason: 'install playwright' })));
  await expect(client.take(payload('s'))).resolves.toBeNull();
  expect(client.status()).toBe('install playwright');
});

it('reports itself available again once a capture after a 503 succeeds', async () => {
  vi.stubGlobal('createImageBitmap', async () => ({}) as ImageBitmap);
  let down = true;
  const send = (async () =>
    down ? new Response(JSON.stringify({ reason: 'restarting' }), { status: 503 }) : new Response(new Blob(['png']))) as typeof fetch;
  const client = createCaptureClient('/', send);
  await client.take(payload('s'));
  expect(client.status()).toBe('restarting');
  down = false;
  await expect(client.take(payload('s'))).resolves.not.toBeNull();
  expect(client.status()).toBe(true);
  vi.unstubAllGlobals();
});

it('rejects a capture refused as busy and still reports itself available', async () => {
  const client = createCaptureClient('/', answering(429, JSON.stringify({ error: 'capture queue is full' })));
  await expect(client.take(payload('s'))).rejects.toThrow('capture queue is full');
  expect(client.status()).not.toBe('capture queue is full');
});
