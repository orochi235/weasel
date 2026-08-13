import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './test-utils/fakeOffscreenCanvas';
import { resolvePatternSpec, resolveFillPattern, isPatternSpec, _resetPatternSpecCacheForTests } from './resolveSpec';
import { _resetTextureRegistryForTests } from '../../renderer/textures/registerTexture';
import type { FillStyle, TilePatternSpec } from '../../core/paint-types';

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
    const payload = (out as Extract<FillStyle, { fill: 'pattern' }>).pattern;
    expect(isPatternSpec(payload)).toBe(false);
    expect(payload).toHaveProperty('id');
  });

  it('preserves the paint\'s other fields', () => {
    const out = resolveFillPattern({
      fill: 'pattern', pattern: HATCH, units: 'local', origin: { x: 3, y: 4 }, opacity: 0.5,
    }) as Extract<FillStyle, { fill: 'pattern' }>;
    expect(out.units).toBe('local');
    expect(out.origin).toEqual({ x: 3, y: 4 });
    expect(out.opacity).toBe(0.5);
  });

  it('leaves a handle payload and non-pattern fills alone', () => {
    const handlePaint: FillStyle = { fill: 'pattern', pattern: { id: 'tex_9' } };
    expect(resolveFillPattern(handlePaint)).toBe(handlePaint);

    const solid: FillStyle = { color: '#123456' };
    expect(resolveFillPattern(solid)).toBe(solid);
  });
});
