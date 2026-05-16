import { describe, it, expect, vi } from 'vitest';
import { getStylusData, forEachCoalesced, pressureToWidth, type CoalescedCtx } from './stylus';

function makeEvent(
  partial: Partial<PointerEvent> & { altitudeAngle?: number; azimuthAngle?: number },
): PointerEvent {
  // PointerEvent constructor in jsdom doesn't accept every field via init,
  // so build a plain object and cast — the helpers only read fields, not
  // call methods that rely on a real prototype.
  return {
    clientX: 0,
    clientY: 0,
    pressure: 0.5,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 'mouse',
    ...partial,
  } as unknown as PointerEvent;
}

describe('getStylusData', () => {
  it('reads pen pressure / tilt / pointerType', () => {
    const e = makeEvent({
      pointerType: 'pen',
      pressure: 0.42,
      tiltX: -12,
      tiltY: 8,
      twist: 0,
    });
    const s = getStylusData(e);
    expect(s).toMatchObject({
      pressure: 0.42,
      tiltX: -12,
      tiltY: 8,
      pointerType: 'pen',
      isStylus: true,
    });
  });

  it('non-pen events report isStylus: false', () => {
    expect(getStylusData(makeEvent({ pointerType: 'mouse' })).isStylus).toBe(false);
    expect(getStylusData(makeEvent({ pointerType: 'touch' })).isStylus).toBe(false);
  });

  it('surfaces altitude/azimuth when present, undefined when absent', () => {
    const withAngles = getStylusData(makeEvent({
      pointerType: 'pen',
      altitudeAngle: 1.2,
      azimuthAngle: 0.5,
    }));
    expect(withAngles.altitudeAngle).toBe(1.2);
    expect(withAngles.azimuthAngle).toBe(0.5);

    const without = getStylusData(makeEvent({ pointerType: 'pen' }));
    expect(without.altitudeAngle).toBeUndefined();
    expect(without.azimuthAngle).toBeUndefined();
  });

  it('defaults tilt/twist to 0 when fields are missing (older browsers)', () => {
    const bare = { clientX: 0, clientY: 0, pressure: 0, pointerType: 'pen' } as unknown as PointerEvent;
    const s = getStylusData(bare);
    expect(s.tiltX).toBe(0);
    expect(s.tiltY).toBe(0);
    expect(s.twist).toBe(0);
  });
});

describe('forEachCoalesced', () => {
  const ctx: CoalescedCtx = {
    canvasRect: { left: 100, top: 50 },
    view: { x: 0, y: 0, scale: 2 },
  };

  it('iterates getCoalescedEvents() when populated', () => {
    const sub: PointerEvent[] = [
      makeEvent({ clientX: 110, clientY: 60, pressure: 0.1, pointerType: 'pen' }),
      makeEvent({ clientX: 120, clientY: 70, pressure: 0.2, pointerType: 'pen' }),
      makeEvent({ clientX: 130, clientY: 80, pressure: 0.3, pointerType: 'pen' }),
    ];
    const parent = {
      ...sub[2],
      getCoalescedEvents: () => sub,
    } as unknown as PointerEvent;
    const samples: { worldX: number; worldY: number; pressure: number }[] = [];
    forEachCoalesced(parent, ctx, (s) => {
      samples.push({ worldX: s.worldX, worldY: s.worldY, pressure: s.stylus.pressure });
    });
    expect(samples).toEqual([
      { worldX: 5, worldY: 5, pressure: 0.1 },   // (110-100)/2, (60-50)/2
      { worldX: 10, worldY: 10, pressure: 0.2 },
      { worldX: 15, worldY: 15, pressure: 0.3 },
    ]);
  });

  it('falls back to the parent event when getCoalescedEvents returns empty', () => {
    const parent = {
      ...makeEvent({ clientX: 200, clientY: 100, pressure: 0.7, pointerType: 'pen' }),
      getCoalescedEvents: () => [],
    } as unknown as PointerEvent;
    const cb = vi.fn();
    forEachCoalesced(parent, ctx, cb);
    expect(cb).toHaveBeenCalledTimes(1);
    const sample = cb.mock.calls[0][0];
    expect(sample.worldX).toBe(50); // (200-100)/2
    expect(sample.worldY).toBe(25); // (100-50)/2
    expect(sample.stylus.pressure).toBe(0.7);
  });

  it('falls back when getCoalescedEvents is undefined (older browsers)', () => {
    const parent = makeEvent({ clientX: 150, clientY: 70, pressure: 0.4 });
    const cb = vi.fn();
    forEachCoalesced(parent, ctx, cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('applies view offset when transforming to world coords', () => {
    const offsetCtx: CoalescedCtx = {
      canvasRect: { left: 0, top: 0 },
      view: { x: 100, y: 50, scale: 1 },
    };
    const parent = {
      ...makeEvent({ clientX: 10, clientY: 20 }),
      getCoalescedEvents: () => [makeEvent({ clientX: 10, clientY: 20 })],
    } as unknown as PointerEvent;
    let world: { x: number; y: number } | null = null;
    forEachCoalesced(parent, offsetCtx, (s) => { world = { x: s.worldX, y: s.worldY }; });
    expect(world).toEqual({ x: 110, y: 70 });
  });
});

describe('pressureToWidth', () => {
  it('returns minWidth at pressure 0 and maxWidth at pressure 1', () => {
    expect(pressureToWidth(0, { minWidth: 1, maxWidth: 10 })).toBeCloseTo(1);
    expect(pressureToWidth(1, { minWidth: 1, maxWidth: 10 })).toBeCloseTo(10);
  });

  it('clamps pressure into [0, 1]', () => {
    expect(pressureToWidth(-2, { minWidth: 1, maxWidth: 10 })).toBeCloseTo(1);
    expect(pressureToWidth(7, { minWidth: 1, maxWidth: 10 })).toBeCloseTo(10);
  });

  it('gamma > 1 biases toward thinner widths at mid pressure', () => {
    const linear = pressureToWidth(0.5, { minWidth: 0, maxWidth: 10, gamma: 1 });
    const biased = pressureToWidth(0.5, { minWidth: 0, maxWidth: 10, gamma: 2 });
    expect(biased).toBeLessThan(linear);
    expect(biased).toBeCloseTo(2.5);  // 0.5^2 = 0.25 → 0..10 → 2.5
    expect(linear).toBeCloseTo(5);
  });

  it('defaults: pressure 0 → 0.5, pressure 1 → 6', () => {
    expect(pressureToWidth(0)).toBeCloseTo(0.5);
    expect(pressureToWidth(1)).toBeCloseTo(6);
  });
});
