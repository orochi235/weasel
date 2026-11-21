import { expect, it } from 'vitest';
import { registerPropertyFont } from './pbt.fixture';

it('registerPropertyFont leaves fetch and createImageBitmap as it found them', async () => {
  const held = { fetch: globalThis.fetch, createImageBitmap: globalThis.createImageBitmap };
  await registerPropertyFont();
  expect(globalThis.fetch).toBe(held.fetch);
  expect(globalThis.createImageBitmap).toBe(held.createImageBitmap);
});
