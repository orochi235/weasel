import { describe, expect, it, vi } from 'vitest';
import { worldToScreen } from '../canvas/canvasCoords';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { DEFAULT_FRAME, resolveFrame } from '../canvas/worldSpec';
import { drawCanvasLens, lensCamera, lensSourceRect, sampleStack } from './canvasLens';

const outer = { zoom: 2, pan: { x: 30, y: -10 } };

describe('lensCamera', () => {
  it('multiplies the stack zoom by the factor', () => {
    expect(lensCamera({ x: 50, y: 50 }, outer, DEFAULT_FRAME, 6, 200).view.zoom).toBe(12);
  });

  it('puts the aimed world point at the middle of the lens', () => {
    const aim = { x: 137, y: 61 };
    const lens = lensCamera(aim, outer, DEFAULT_FRAME, 6, 200);
    // The world point the stack shows at `aim`, projected through the lens.
    const world = {
      x: (aim.x - outer.pan.x) / outer.zoom,
      y: (aim.y - outer.pan.y) / outer.zoom,
    };
    const p = worldToScreen(world, lens.view, lens.frame);
    expect(p.x).toBeCloseTo(100, 8);
    expect(p.y).toBeCloseTo(100, 8);
  });

  it('resolves the world spec against the lens, not the stack', () => {
    const spec = { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' as const };
    const stackFrame = resolveFrame(spec, { width: 800, height: 600 });
    const lens = lensCamera({ x: 137, y: 61 }, outer, stackFrame, 6, 200, spec);
    expect(lens.frame.originPx).toEqual({ x: 100, y: 100 });
    expect(lens.frame.yDir).toBe(-1);
  });

  it('centres the same world point on a flipped, re-origined frame', () => {
    const spec = { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' as const };
    const stackFrame = resolveFrame(spec, { width: 800, height: 600 });
    const aim = { x: 137, y: 61 };
    const lens = lensCamera(aim, outer, stackFrame, 6, 200, spec);
    const world = {
      x: (aim.x - stackFrame.originPx.x - outer.pan.x) / outer.zoom,
      y: (aim.y - stackFrame.originPx.y - outer.pan.y) / (outer.zoom * stackFrame.yDir),
    };
    const p = worldToScreen(world, lens.view, lens.frame);
    expect(p.x).toBeCloseTo(100, 8);
    expect(p.y).toBeCloseTo(100, 8);
  });
});

describe('lensSourceRect', () => {
  it('copies the diameter-over-factor CSS px around the aim', () => {
    expect(lensSourceRect({ x: 100, y: 50 }, 4, 200, 1)).toEqual({
      sx: 75,
      sy: 25,
      sw: 50,
      sh: 50,
    });
  });

  it('is measured in backing-store pixels', () => {
    expect(lensSourceRect({ x: 100, y: 50 }, 4, 200, 2)).toEqual({
      sx: 150,
      sy: 50,
      sw: 100,
      sh: 100,
    });
  });
});

function fakeCanvas(pixel: [number, number, number, number] | null): HTMLCanvasElement {
  return {
    width: 100,
    height: 100,
    getContext: () =>
      pixel === null ? null : { getImageData: () => ({ data: Uint8ClampedArray.from(pixel) }) },
  } as unknown as HTMLCanvasElement;
}

describe('sampleStack', () => {
  const layers = (ids: string[]): CanvasLayerDescriptor[] =>
    ids.map((id) => ({ id, visible: true, render: vi.fn() }));

  it('reports the topmost layer with something opaque there', () => {
    const canvases = new Map([
      ['under', fakeCanvas([0, 0, 255, 255])],
      ['over', fakeCanvas([255, 0, 0, 255])],
    ]);
    expect(sampleStack(layers(['under', 'over']), canvases, { x: 5, y: 5 }, 1)).toBe('#ff0000');
  });

  it('falls through a transparent pixel to the layer below', () => {
    const canvases = new Map([
      ['under', fakeCanvas([0, 0, 255, 255])],
      ['over', fakeCanvas([255, 0, 0, 0])],
    ]);
    expect(sampleStack(layers(['under', 'over']), canvases, { x: 5, y: 5 }, 1)).toBe('#0000ff');
  });

  it('skips a hidden layer even when it has pixels', () => {
    const stack = layers(['under', 'over']);
    stack[1].visible = false;
    const canvases = new Map([
      ['under', fakeCanvas([0, 0, 255, 255])],
      ['over', fakeCanvas([255, 0, 0, 255])],
    ]);
    expect(sampleStack(stack, canvases, { x: 5, y: 5 }, 1)).toBe('#0000ff');
  });

  it('says nothing rather than black when every layer is transparent', () => {
    const canvases = new Map([['only', fakeCanvas([0, 0, 0, 0])]]);
    expect(sampleStack(layers(['only']), canvases, { x: 5, y: 5 }, 1)).toBeNull();
  });

  it('says nothing for a point off the backing store', () => {
    const canvases = new Map([['only', fakeCanvas([255, 0, 0, 255])]]);
    expect(sampleStack(layers(['only']), canvases, { x: 400, y: 5 }, 1)).toBeNull();
  });

  it('pads a single-digit channel, so #0a0a0a is not #aaa', () => {
    const canvases = new Map([['only', fakeCanvas([10, 10, 10, 255])]]);
    expect(sampleStack(layers(['only']), canvases, { x: 5, y: 5 }, 1)).toBe('#0a0a0a');
  });
});

function recordingContext(): CanvasRenderingContext2D & { calls: unknown[][] } {
  const calls: unknown[][] = [];
  const ctx = {
    calls,
    imageSmoothingEnabled: true,
    save: () => calls.push(['save']),
    restore: () => calls.push(['restore']),
    setTransform: (...a: unknown[]) => calls.push(['setTransform', ...a]),
    clearRect: (...a: unknown[]) => calls.push(['clearRect', ...a]),
    drawImage: (...a: unknown[]) => calls.push(['drawImage', ...a]),
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: unknown[][] };
}

describe('drawCanvasLens', () => {
  const base = {
    aim: { x: 100, y: 50 },
    factor: 4,
    diameter: 200,
    dpr: 1,
    outer,
    layers: [] as CanvasLayerDescriptor[],
    canvases: new Map<string, HTMLCanvasElement>(),
  };

  it('re-runs each visible layer at the lens camera in vector mode', () => {
    const under = vi.fn();
    const over = vi.fn();
    const hidden = vi.fn();
    const layers: CanvasLayerDescriptor[] = [
      { id: 'under', visible: true, render: under },
      { id: 'hidden', visible: false, render: hidden },
      { id: 'over', visible: true, render: over },
    ];
    const ctx = recordingContext();
    drawCanvasLens(ctx, { ...base, mode: 'vector', layers });

    expect(hidden).not.toHaveBeenCalled();
    const expected = lensCamera(base.aim, outer, DEFAULT_FRAME, 4, 200);
    for (const fn of [under, over]) {
      expect(fn).toHaveBeenCalledWith(ctx, expected.view, expected.frame);
    }
    // Bottom layer first, so the stack composites the way the trial shows it.
    expect(under.mock.invocationCallOrder[0]).toBeLessThan(over.mock.invocationCallOrder[0]);
  });

  it('enlarges the presented pixels with smoothing off in pixel mode', () => {
    const canvases = new Map([['only', fakeCanvas([0, 0, 0, 255])]]);
    const layers: CanvasLayerDescriptor[] = [{ id: 'only', visible: true, render: vi.fn() }];
    const ctx = recordingContext();
    drawCanvasLens(ctx, { ...base, mode: 'pixel', layers, canvases });

    expect(ctx.imageSmoothingEnabled).toBe(false);
    const draw = ctx.calls.find((c) => c[0] === 'drawImage');
    expect(draw?.slice(2)).toEqual([75, 25, 50, 50, 0, 0, 200, 200]);
  });

  it('does not re-run a layer draw in pixel mode', () => {
    const render = vi.fn();
    const canvases = new Map([['only', fakeCanvas([0, 0, 0, 255])]]);
    drawCanvasLens(recordingContext(), {
      ...base,
      mode: 'pixel',
      layers: [{ id: 'only', visible: true, render }],
      canvases,
    });
    expect(render).not.toHaveBeenCalled();
  });

  it('skips a backing store with no pixels rather than throwing', () => {
    const empty = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    const ctx = recordingContext();
    drawCanvasLens(ctx, {
      ...base,
      mode: 'pixel',
      layers: [{ id: 'only', visible: true, render: vi.fn() }],
      canvases: new Map([['only', empty]]),
    });
    expect(ctx.calls.some((c) => c[0] === 'drawImage')).toBe(false);
  });
});
