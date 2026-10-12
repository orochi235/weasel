import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TilePatternSpec } from '@weasel-js/paint';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetTextureRegistryForTests, textureRegistry } from './textures/registerTexture';
import {
  resolvePatternSpec, _resetPatternSpecCacheForTests, PATTERN_TILE_CACHE_LIMIT,
} from 'renderer/patterns/resolveSpec';
import {
  installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas,
} from 'renderer/patterns/test-utils/fakeOffscreenCanvas';

const shade = (i: number): TilePatternSpec => ({ tile: 'hatch', color: `#${i.toString(16).padStart(6, '0')}` });

describe('a pattern tile evicted while a draw command still holds its handle', () => {
  beforeEach(() => {
    installFakeOffscreenCanvas();
    _resetPatternSpecCacheForTests();
    _resetTextureRegistryForTests();
  });
  afterEach(() => {
    uninstallFakeOffscreenCanvas();
    vi.restoreAllMocks();
  });

  function setup() {
    const rec = makeGLRecorder();
    const r = new WeaselRenderer({ gl: rec.gl, width: 100, height: 100, dpr: 1 });
    const handle = resolvePatternSpec({ tile: 'dots', color: '#fff' })!;
    // A memoized painter's output: built once, drawn on every later frame.
    const commands: DrawCommand[] = [{
      kind: 'path',
      path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      fill: { fill: 'pattern', pattern: handle },
    }];
    rec.reset();
    r.render(commands);
    const made = rec.calls.filter((c) => c.name === 'createTexture').map((c) => c.result);
    const source = textureRegistry.get(handle.id)!.source;
    const firstUpload = rec.calls.find((c) => c.name === 'texImage2D' && c.args.at(-1) === source);
    return { rec, r, handle, commands, made, firstUpload };
  }

  const evict = () => {
    for (let i = 0; i < PATTERN_TILE_CACHE_LIMIT; i++) resolvePatternSpec(shade(i));
  };

  it('uploads once and draws from that texture while the tile stays registered', () => {
    const { rec, r, commands, made, firstUpload } = setup();
    expect(made.length).toBe(1);
    expect(firstUpload).toBeDefined();
    rec.reset();
    r.render(commands);
    expect(rec.calls.some((c) => c.name === 'texImage2D' || c.name === 'deleteTexture')).toBe(false);
    expect(rec.calls.some((c) => c.name === 'bindTexture' && c.args[1] === made[0])).toBe(true);
  });

  it('frees the GL texture, then rebuilds and draws the tile, with no warning', () => {
    const { rec, r, handle, commands, made } = setup();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    evict();
    expect(textureRegistry.has(handle.id)).toBe(false);

    rec.reset();
    r.render(commands);

    const names = rec.calls.map((c) => c.name);
    const deleted = rec.calls.filter((c) => c.name === 'deleteTexture');
    expect(deleted.map((c) => c.args[0])).toEqual([made[0]]);
    // Before anything in the frame draws.
    expect(names.indexOf('deleteTexture')).toBeLessThan(names.indexOf('drawElements'));

    const revived = textureRegistry.get(handle.id)?.source;
    expect(revived).toBeDefined();
    const uploads = rec.calls.filter((c) => c.name === 'texImage2D' && c.args.at(-1) === revived);
    expect(uploads.length).toBe(1);
    const remade = rec.calls.filter((c) => c.name === 'createTexture').map((c) => c.result);
    expect(remade.length).toBe(1);
    expect(rec.calls.some((c) => c.name === 'bindTexture' && c.args[1] === remade[0])).toBe(true);
    expect(rec.calls.some((c) => c.name === 'drawElements' || c.name === 'drawArrays')).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves the GL texture of a tile nobody draws to the next frame, then frees it', () => {
    const { rec, r, made } = setup();
    evict();
    rec.reset();
    r.render([]);
    expect(rec.calls.filter((c) => c.name === 'deleteTexture').map((c) => c.args[0])).toEqual([made[0]]);
  });
});
