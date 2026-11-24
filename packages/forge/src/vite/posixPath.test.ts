import { describe, expect, it } from 'vitest';
import { posix } from './posixPath.ts';

describe('posix', () => {
  it('writes a Windows path with slashes', () => {
    expect(posix('packages\\ui\\src\\Button.stories.tsx', '\\')).toBe('packages/ui/src/Button.stories.tsx');
  });
});
