import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageLocalStorage } from './pageStorage';

afterEach(() => vi.restoreAllMocks());

describe('pageLocalStorage', () => {
  it('answers undefined where reading localStorage throws, as with site data blocked', () => {
    vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(pageLocalStorage()).toBeUndefined();
  });

  it("answers the page's localStorage where it can be read", () => {
    expect(pageLocalStorage()).toBe(globalThis.localStorage);
  });
});
