/** Counterexamples headless's second-pass properties shrank to. */
import { describe, expect, it } from 'vitest';
import { readPageRequest } from './protocol';

describe('shrunk counterexamples', () => {
  it('refuses a rect or scale the page cannot render, before a browser starts', () => {
    const req = { scene: {}, sourceRect: { x: 0, y: 0, width: 0, height: 10 }, scale: { x: 1, y: 1 }, format: 'rgba' };
    expect(() => readPageRequest(req)).toThrow(/headless render request: sourceRect\.width must be a positive number/);
    expect(() => readPageRequest({ ...req, sourceRect: { x: 0, y: 0, width: 1, height: 1 }, scale: { x: 0, y: 1 } }))
      .toThrow(/headless render request: scale\.x must be a nonzero number/);
  });
});
