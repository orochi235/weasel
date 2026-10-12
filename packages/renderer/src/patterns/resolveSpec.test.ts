import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './test-utils/fakeOffscreenCanvas';
import {
  resolvePatternSpec, resolveFillPattern, isPatternSpec, _resetPatternSpecCacheForTests,
  PATTERN_TILE_CACHE_LIMIT,
} from './resolveSpec';
import { _resetTextureRegistryForTests, getTexture, textureRegistry } from '../textures/registerTexture';
import type { Paint, TilePatternSpec } from '@weasel-js/paint';

const HATCH: TilePatternSpec = { tile: 'hatch', color: '#0fb5a8' };

describe('resolvePatternSpec', () => {
  beforeEach(() => {
    installFakeOffscreenCanvas();
    _resetPatternSpecCacheForTests();
    _resetTextureRegistryForTests();
  });
  afterEach(uninstallFakeOffscreenCanvas);

  it('returns the same handle for an equal spec', () => {
    const a = resolvePatternSpec(HATCH);
    const b = resolvePatternSpec({ tile: 'hatch', color: '#0fb5a8' });
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('ignores key order, since a spec from JSON has no guaranteed one', () => {
    const a = resolvePatternSpec({ tile: 'dots', color: '#fff', size: 8 });
    const b = resolvePatternSpec({ size: 8, color: '#fff', tile: 'dots' });
    expect(b).toBe(a);
  });

  it('builds a distinct texture per differing spec', () => {
    const a = resolvePatternSpec(HATCH);
    const b = resolvePatternSpec({ ...HATCH, color: '#ff0000' });
    const c = resolvePatternSpec({ ...HATCH, size: 12 });
    expect(a?.id).not.toBe(b?.id);
    expect(a?.id).not.toBe(c?.id);
  });
});

describe('the pattern tile cache', () => {
  beforeEach(() => {
    installFakeOffscreenCanvas();
    _resetPatternSpecCacheForTests();
    _resetTextureRegistryForTests();
  });
  afterEach(uninstallFakeOffscreenCanvas);

  const shade = (i: number): TilePatternSpec => ({ tile: 'hatch', color: `#${i.toString(16).padStart(6, '0')}` });

  it('holds no more than its limit, and unregisters what it drops', () => {
    const extra = 5;
    const handles = Array.from({ length: PATTERN_TILE_CACHE_LIMIT + extra }, (_, i) => resolvePatternSpec(shade(i))!);
    expect(textureRegistry.entries().length).toBe(PATTERN_TILE_CACHE_LIMIT);
    for (const h of handles.slice(0, extra)) expect(textureRegistry.has(h.id)).toBe(false);
    for (const h of handles.slice(extra)) expect(textureRegistry.has(h.id)).toBe(true);
  });

  it('closes the bitmap of a tile it drops', () => {
    const first = resolvePatternSpec(shade(0))!;
    const bitmap = textureRegistry.get(first.id)!.source as ImageBitmap;
    let closed = 0;
    bitmap.close = () => { closed++; };
    for (let i = 1; i <= PATTERN_TILE_CACHE_LIMIT; i++) resolvePatternSpec(shade(i));
    expect(closed).toBe(1);
  });

  it('keeps a tile that was drawn over an older one that was not', () => {
    const drawn = resolvePatternSpec(shade(0))!;
    const idle = resolvePatternSpec(shade(1))!;
    for (let i = 2; i < PATTERN_TILE_CACHE_LIMIT; i++) resolvePatternSpec(shade(i));
    // What a renderer does on every pattern draw.
    getTexture(drawn.id);
    resolvePatternSpec(shade(PATTERN_TILE_CACHE_LIMIT));
    expect(textureRegistry.has(drawn.id)).toBe(true);
    expect(textureRegistry.has(idle.id)).toBe(false);
  });

  it('rebuilds a dropped tile under the same id when a held handle is drawn again', () => {
    const held = resolvePatternSpec({ tile: 'dots', color: '#fff', size: 8, radius: 2 })!;
    for (let i = 0; i < PATTERN_TILE_CACHE_LIMIT; i++) resolvePatternSpec(shade(i));
    expect(textureRegistry.has(held.id)).toBe(false);

    const entry = getTexture(held.id);
    expect(entry).not.toBeNull();
    expect((entry!.source as ImageBitmap).width).toBe(8);
    expect(textureRegistry.entries().length).toBe(PATTERN_TILE_CACHE_LIMIT);
    expect(resolvePatternSpec({ tile: 'dots', color: '#fff', size: 8, radius: 2 })?.id).toBe(held.id);
  });
});

describe('resolveFillPattern', () => {
  beforeEach(() => {
    installFakeOffscreenCanvas();
    _resetPatternSpecCacheForTests();
    _resetTextureRegistryForTests();
  });
  afterEach(uninstallFakeOffscreenCanvas);

  it('swaps a spec payload for a handle', () => {
    const out = resolveFillPattern({ fill: 'pattern', pattern: HATCH });
    expect(out).not.toBeNull();
    const payload = (out as Extract<Paint, { fill: 'pattern' }>).pattern;
    expect(isPatternSpec(payload)).toBe(false);
    expect(payload).toHaveProperty('id');
  });

  it('preserves the paint\'s other fields', () => {
    const out = resolveFillPattern({
      fill: 'pattern', pattern: HATCH, units: 'local', origin: { x: 3, y: 4 }, opacity: 0.5,
    }) as Extract<Paint, { fill: 'pattern' }>;
    expect(out.units).toBe('local');
    expect(out.origin).toEqual({ x: 3, y: 4 });
    expect(out.opacity).toBe(0.5);
  });

  it('leaves a handle payload and non-pattern fills alone', () => {
    const handlePaint: Paint = { fill: 'pattern', pattern: { id: 'tex_9' } };
    expect(resolveFillPattern(handlePaint)).toBe(handlePaint);

    const solid: Paint = { color: '#123456' };
    expect(resolveFillPattern(solid)).toBe(solid);
  });
});
