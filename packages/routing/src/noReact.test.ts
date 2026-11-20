import { describe, expect, it, vi } from 'vitest';

vi.mock('react', () => {
  throw new Error('the main entry loaded react');
});

describe('the main entry', () => {
  it('loads without react', async () => {
    await expect(import('./index')).resolves.toBeDefined();
  });
});
