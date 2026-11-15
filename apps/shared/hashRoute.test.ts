import { describe, expect, it } from 'vitest';
import { hashRoute } from './hashRoute';

const ROUTES = ['palette', 'theme'] as const;

describe('hashRoute', () => {
  it('reads the route a hash names, with or without its slash', () => {
    expect(hashRoute('#/theme', ROUTES, 'palette')).toBe('theme');
    expect(hashRoute('#theme', ROUTES, 'palette')).toBe('theme');
  });

  it('falls back for an empty hash and one naming no route', () => {
    expect(hashRoute('', ROUTES, 'palette')).toBe('palette');
    expect(hashRoute('#/nowhere', ROUTES, 'palette')).toBe('palette');
  });
});
