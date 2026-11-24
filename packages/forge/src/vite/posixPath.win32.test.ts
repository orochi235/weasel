import { describe, expect, it, vi } from 'vitest';
import { posixResolve } from './posixPath.ts';

vi.mock('node:path', async (actual) => {
  const path = await actual<typeof import('node:path')>();
  return { ...path.win32, default: path.win32 };
});

describe('posixResolve on Windows', () => {
  it('resolves to the slashed path vite writes for a module id', () => {
    expect(posixResolve('C:\\app', 'src/Button.stories.tsx')).toBe('C:/app/src/Button.stories.tsx');
    expect(posixResolve('C:\\app\\src\\Button.stories.tsx')).toBe('C:/app/src/Button.stories.tsx');
  });
});
