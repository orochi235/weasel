import { describe, expect, it } from 'vitest';
import type { MoveAdapter } from './types';

// Fails to compile while `MoveAdapter` declares the field: nothing in the kit calls it.
const noSnapHook: 'findSnapTarget' extends keyof MoveAdapter<{ id: string }, unknown> ? false : true = true;

describe('MoveAdapter', () => {
  it('declares no findSnapTarget', () => {
    expect(noSnapHook).toBe(true);
  });
});
