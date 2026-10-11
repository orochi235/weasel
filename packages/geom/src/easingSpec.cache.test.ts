import { describe, expect, it } from 'vitest';
import { resolveEasing } from './easingSpec';

describe('resolveEasing', () => {
  it('gives equal bezier specs one function', () => {
    expect(resolveEasing({ bezier: [0.1, 0.2, 0.3, 0.4] })).toBe(resolveEasing({ bezier: [0.1, 0.2, 0.3, 0.4] }));
  });

  it('forgets a bezier after enough others, instead of keeping every one', () => {
    const first = resolveEasing({ bezier: [0.5, 0, 0.5, 1] });
    for (let i = 0; i < 2000; i++) resolveEasing({ bezier: [i / 2000, 0, 0.5, 1] });
    expect(resolveEasing({ bezier: [0.5, 0, 0.5, 1] })).not.toBe(first);
  });
});
