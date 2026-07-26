import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTexture,
  getTexture,
  _resetTextureRegistryForTests,
} from './registerTexture';

function makeImageStub(): HTMLImageElement {
  return { src: 'test.png', width: 4, height: 4 } as unknown as HTMLImageElement;
}

describe('registerTexture', () => {
  beforeEach(() => _resetTextureRegistryForTests());

  it('returns a handle with a non-empty id', () => {
    const img = makeImageStub();
    const h = registerTexture(img);
    expect(h.id).toBeTruthy();
  });

  it('returns distinct handles for separate registrations', () => {
    const a = registerTexture(makeImageStub());
    const b = registerTexture(makeImageStub());
    expect(a.id).not.toBe(b.id);
  });

  it('getTexture returns the registered source', () => {
    const img = makeImageStub();
    const h = registerTexture(img);
    const entry = getTexture(h.id);
    expect(entry?.source).toBe(img);
  });

  it('getTexture returns null for an unknown id', () => {
    expect(getTexture('nonexistent')).toBeNull();
  });

  it('ids are stable — same handle object as returned', () => {
    const h = registerTexture(makeImageStub());
    expect(getTexture(h.id)).not.toBeNull();
  });
});
