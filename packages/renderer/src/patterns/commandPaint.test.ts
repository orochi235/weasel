import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Paint, Stroke } from '@weasel-js/paint';
import type { PathDrawCommand } from '../DrawCommand';
import { installFakeOffscreenCanvas, uninstallFakeOffscreenCanvas } from './test-utils/fakeOffscreenCanvas';
import { _resetPatternSpecCacheForTests } from './resolveSpec';
import { _resetTextureRegistryForTests } from '../textures/registerTexture';
import { commandPaint, commandStroke } from './commandPaint';

const BOX = { x: 10, y: 20, width: 100, height: 50 };
const RECT = { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } as const;
const BOUNDS_GRADIENT: Paint = {
  kind: 'linear-gradient',
  from: { x: 0, y: 0 }, to: { x: 1, y: 1 },
  stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
  units: 'bounds',
};
const HATCH: Paint = { kind: 'hatch', color: '#000', units: 'bounds' };

describe('commandPaint', () => {
  beforeEach(() => {
    installFakeOffscreenCanvas();
    _resetPatternSpecCacheForTests();
    _resetTextureRegistryForTests();
  });
  afterEach(uninstallFakeOffscreenCanvas);

  it('maps a bounds gradient onto the box', () => {
    expect(commandPaint(BOUNDS_GRADIENT, BOX)).toMatchObject({
      units: 'local', from: { x: 10, y: 20 }, to: { x: 110, y: 70 },
    });
  });

  it('swaps a tile paint for its texture and anchors it to the box', () => {
    const fill = commandPaint(HATCH, BOX);
    expect(fill).toMatchObject({
      kind: 'texture', texture: { id: expect.any(String) }, units: 'local', origin: { x: 10, y: 20 },
    });
  });

  it('answers null for a spec that cannot rasterize', () => {
    uninstallFakeOffscreenCanvas();
    expect(commandPaint(HATCH, BOX)).toBeNull();
  });
});

describe('commandStroke', () => {
  it('resolves the paint and keeps every other field', () => {
    const stroke: Stroke = { paint: BOUNDS_GRADIENT, width: 3, dash: [2, 2] };
    expect(commandStroke(stroke, BOX)).toMatchObject({ width: 3, dash: [2, 2], paint: { units: 'local' } });
  });

  it('hands back the same stroke when its paint needed nothing', () => {
    // The renderer's ribbon and marker caches key on the stroke object.
    const stroke: Stroke = { paint: { color: '#f00' }, width: 3 };
    expect(commandStroke(stroke, BOX)).toBe(stroke);
  });

  it('answers null for a stroke with no paint', () => {
    expect(commandStroke({ width: 3 }, BOX)).toBeNull();
  });
});

describe('PathDrawCommand paint', () => {
  it('rejects what only a node painter can resolve', () => {
    const cmds: PathDrawCommand[] = [
      // @ts-expect-error a tile spec is not a registered texture
      { kind: 'path', path: RECT, fill: { kind: 'hatch', color: '#000' } },
      // @ts-expect-error a command has no node box for 'bounds' to mean
      { kind: 'path', path: RECT, fill: BOUNDS_GRADIENT },
      // @ts-expect-error the same holds for a stroke's paint
      { kind: 'path', path: RECT, stroke: { paint: BOUNDS_GRADIENT, width: 1 } },
      { kind: 'path', path: RECT, fill: { ...BOUNDS_GRADIENT, units: 'world' } },
    ];
    expect(cmds).toHaveLength(4);
  });
});
