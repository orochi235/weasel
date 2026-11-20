import { expect, it } from 'vitest';
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
