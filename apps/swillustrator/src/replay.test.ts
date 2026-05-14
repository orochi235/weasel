import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { replayRecording } from './replay';
import type { Recording } from './recorder';

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  document.body.appendChild(c);
  return c;
}

function baseRecording(events: Recording['events']): Recording {
  return {
    version: 1,
    startedAt: new Date().toISOString(),
    viewport: { w: 1000, h: 800 },
    scene: null,
    events,
  };
}

describe('replayRecording', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
    // jsdom doesn't implement requestAnimationFrame the same way browsers do
    // — vitest's environment usually polyfills it, but pin a setTimeout
    // fallback if it's missing.
    if (typeof (globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame !== 'function') {
      (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number }).requestAnimationFrame =
        (cb: FrameRequestCallback): number => setTimeout(() => cb(performance.now()), 0) as unknown as number;
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('dispatches pointer/wheel/keyboard events with matching coords + keys', async () => {
    const seen: Array<{ type: string; x?: number; y?: number; key?: string; deltaY?: number }> = [];
    canvas.addEventListener('pointerdown', (e) => {
      const pe = e as PointerEvent;
      seen.push({ type: 'pointerdown', x: pe.clientX, y: pe.clientY });
    });
    canvas.addEventListener('pointerup', (e) => {
      const pe = e as PointerEvent;
      seen.push({ type: 'pointerup', x: pe.clientX, y: pe.clientY });
    });
    canvas.addEventListener('wheel', (e) => {
      const we = e as WheelEvent;
      seen.push({ type: 'wheel', deltaY: we.deltaY });
    });
    document.addEventListener('keydown', (e) => {
      seen.push({ type: 'keydown', key: (e as KeyboardEvent).key });
    });

    const rec = baseRecording([
      { type: 'pointerdown', t: 0, clientX: 11, clientY: 22, target: 'canvas' },
      { type: 'pointerup',   t: 5, clientX: 33, clientY: 44, target: 'canvas' },
      { type: 'wheel',       t: 8, clientX: 0,  clientY: 0,  deltaY: 50, target: 'canvas' },
      { type: 'keydown',     t: 10, key: 'a',    target: 'document' },
    ]);

    await replayRecording(rec, { canvas, mode: 'flush' });

    expect(seen).toEqual([
      { type: 'pointerdown', x: 11, y: 22 },
      { type: 'pointerup',   x: 33, y: 44 },
      { type: 'wheel',       deltaY: 50 },
      { type: 'keydown',     key: 'a' },
    ]);
  });

  it("flush mode runs faster than realtime mode for the same input", async () => {
    // Recorded over ~120ms. realtime should take ≥ ~100ms; flush should
    // finish in single-digit milliseconds plus a handful of rAF ticks.
    const events: Recording['events'] = [
      { type: 'pointerdown', t: 0,   clientX: 0, clientY: 0, target: 'canvas' },
      { type: 'pointermove', t: 40,  clientX: 1, clientY: 1, target: 'canvas' },
      { type: 'pointermove', t: 80,  clientX: 2, clientY: 2, target: 'canvas' },
      { type: 'pointerup',   t: 120, clientX: 3, clientY: 3, target: 'canvas' },
    ];

    const tFlushStart = performance.now();
    await replayRecording(baseRecording(events), { canvas, mode: 'flush' });
    const flushMs = performance.now() - tFlushStart;

    const tRealStart = performance.now();
    await replayRecording(baseRecording(events), { canvas, mode: 'realtime' });
    const realMs = performance.now() - tRealStart;

    expect(realMs).toBeGreaterThan(flushMs);
    // Realtime should be at least near the recorded span (a little slop for
    // setTimeout's coarse resolution).
    expect(realMs).toBeGreaterThanOrEqual(80);
  });

  it('beforeFirstEvent runs exactly once, before the first event', async () => {
    const order: string[] = [];
    canvas.addEventListener('pointerdown', () => order.push('pointerdown'));
    canvas.addEventListener('pointerup', () => order.push('pointerup'));

    const rec = baseRecording([
      { type: 'pointerdown', t: 0, clientX: 0, clientY: 0, target: 'canvas' },
      { type: 'pointerup',   t: 1, clientX: 0, clientY: 0, target: 'canvas' },
    ]);

    let beforeCalls = 0;
    await replayRecording(rec, {
      canvas,
      mode: 'flush',
      beforeFirstEvent: () => { beforeCalls++; order.push('before'); },
    });
    expect(beforeCalls).toBe(1);
    expect(order).toEqual(['before', 'pointerdown', 'pointerup']);
  });

  it('routes "other" target events to the canvas as a fallback', async () => {
    const seen: string[] = [];
    canvas.addEventListener('pointermove', () => seen.push('canvas'));
    document.addEventListener('pointermove', () => seen.push('document'));

    const rec = baseRecording([
      { type: 'pointermove', t: 0, clientX: 5, clientY: 5, target: 'other' },
    ]);
    await replayRecording(rec, { canvas, mode: 'flush' });
    // Canvas handler fires first (event was dispatched on the canvas);
    // document fires via bubbling.
    expect(seen[0]).toBe('canvas');
  });
});
