import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTexture,
  textureRegistry,
  getTexture,
  unregisterTexture,
  registerTextureAs,
  ownTextureIds,
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

  it('reflects every registered texture under its handle id', () => {
    const img = makeImageStub();
    const h = registerTexture(img);
    expect(textureRegistry.entries().map((e) => [e.key, e.value.source])).toEqual([[h.id, img]]);
  });

  it('unregisterTexture drops the entry and reports whether there was one', () => {
    const h = registerTexture(makeImageStub());
    expect(unregisterTexture(h)).toBe(true);
    expect(getTexture(h.id)).toBeNull();
    expect(textureRegistry.has(h.id)).toBe(false);
    expect(unregisterTexture(h)).toBe(false);
  });
});

describe('an owned texture id', () => {
  beforeEach(() => _resetTextureRegistryForTests());

  it('is rebuilt by its owner when looked up after being unregistered', () => {
    const revived = makeImageStub();
    const asked: string[] = [];
    const release = ownTextureIds('owned-a:', {
      revive: (id) => { asked.push(id); registerTextureAs(id, revived); },
    });
    const h = registerTextureAs('owned-a:1', makeImageStub());
    unregisterTexture(h);
    expect(getTexture(h.id)?.source).toBe(revived);
    expect(asked).toEqual(['owned-a:1']);
    expect(textureRegistry.has(h.id)).toBe(true);
    release();
  });

  it('stays missing when its owner cannot rebuild it, and when nobody owns it', () => {
    const release = ownTextureIds('owned-b:', { revive: () => {} });
    expect(getTexture('owned-b:1')).toBeNull();
    expect(getTexture('stranger:1')).toBeNull();
    release();
  });

  it('tells its owner about every lookup that finds it', () => {
    const touched: string[] = [];
    const release = ownTextureIds('owned-c:', { revive: () => {}, touched: (id) => touched.push(id) });
    registerTextureAs('owned-c:1', makeImageStub());
    registerTexture(makeImageStub());
    getTexture('owned-c:1');
    getTexture('owned-c:1');
    getTexture('tex_1');
    expect(touched).toEqual(['owned-c:1', 'owned-c:1']);
    release();
  });
});
