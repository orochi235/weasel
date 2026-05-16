import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { createRecorder } from './recorder';

// jsdom-friendly: PointerEvent, KeyboardEvent, WheelEvent all exist on the
// jsdom window. We never need a real GPU canvas — a stand-in HTMLCanvasElement
// is enough for the recorder's target classification.

function makeCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  document.body.appendChild(c);
  return c;
}

describe('createRecorder', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = makeCanvas();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('collects dispatched pointer + keyboard events while active', () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start();
    expect(rec.isRecording()).toBe(true);

    canvas.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true, clientX: 10, clientY: 20, pointerType: 'mouse', pointerId: 1, isPrimary: true,
    }));
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: 12, clientY: 24,
    }));
    canvas.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true, clientX: 15, clientY: 30,
    }));
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }));
    document.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));

    const out = rec.stop();
    expect(rec.isRecording()).toBe(false);

    const types = out.events.map((e) => e.type);
    expect(types).toEqual(['pointerdown', 'pointermove', 'pointerup', 'keydown', 'keyup']);
    expect(out.events[0].clientX).toBe(10);
    expect(out.events[0].clientY).toBe(20);
    expect(out.events[3].key).toBe('a');
    expect(out.version).toBe(1);
    expect(out.scene).toBeNull();
  });

  it("captures a scene snapshot at start() via snapshotScene", () => {
    let calls = 0;
    const fakeSnap = {
      version: 1 as const,
      items: [],
      groups: [],
      doc: { size: { width: 100, height: 100 } },
      view: { x: 0, y: 0, scale: 1 },
    };
    const rec = createRecorder({ canvas: () => canvas });
    rec.start({ snapshotScene: () => { calls++; return fakeSnap; } });
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const out = rec.stop();
    expect(calls).toBe(1);
    expect(out.scene).toEqual(fakeSnap);
  });

  it('classifies target as canvas / document / other', () => {
    const other = document.createElement('div');
    document.body.appendChild(other);

    const rec = createRecorder({ canvas: () => canvas });
    rec.start();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'x' }));
    other.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    const out = rec.stop();

    const byType = Object.fromEntries(out.events.map((e) => [e.type, e.target]));
    expect(byType['pointerdown']).toBe('canvas');
    expect(byType['keydown']).toBe('document');
    expect(byType['pointermove']).toBe('other');
  });

  it('t is monotonic and starts near 0', async () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    // Yield to give performance.now() some room to advance.
    await new Promise((r) => setTimeout(r, 5));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 5));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const out = rec.stop();
    expect(out.events).toHaveLength(3);
    expect(out.events[0].t).toBeLessThan(50); // near zero
    expect(out.events[0].t).toBeLessThanOrEqual(out.events[1].t);
    expect(out.events[1].t).toBeLessThanOrEqual(out.events[2].t);
  });

  it('default gesture-only profile drops pointermove outside an active gesture', () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start();
    // Idle pointermove before any down — must be dropped.
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1, clientY: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, pointerId: 1 }));
    // Inside gesture — captured.
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 12, clientY: 12 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 14, clientY: 14, pointerId: 1 }));
    // After pointerup — dropped again.
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 20, clientY: 20 }));
    const out = rec.stop();
    expect(out.events.map((e) => e.type)).toEqual(['pointerdown', 'pointermove', 'pointerup']);
    expect(out.profile).toBe('gesture-only');
  });

  it("profile='full' captures every pointermove regardless of gesture state", () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start({ profile: 'full' });
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 1, clientY: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 2, clientY: 2 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 3, clientY: 3 }));
    const out = rec.stop();
    expect(out.profile).toBe('full');
    expect(out.events.map((e) => e.type)).toEqual([
      'pointermove', 'pointerdown', 'pointermove', 'pointerup', 'pointermove',
    ]);
  });

  it("profile='events-only' drops all pointermove including in-gesture", () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start({ profile: 'events-only' });
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 5 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 6, clientY: 6 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'z' }));
    const out = rec.stop();
    expect(out.profile).toBe('events-only');
    expect(out.events.map((e) => e.type)).toEqual(['pointerdown', 'pointerup', 'keydown']);
  });

  it('pointercancel ends a gesture for the purpose of pointermove gating', () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start();
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 7 }));
    canvas.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 7 }));
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 99, clientY: 99 }));
    const out = rec.stop();
    expect(out.events.map((e) => e.type)).toEqual(['pointerdown', 'pointercancel']);
  });

  it('pointermove records omit button/buttons/pointerType/pointerId, and all-false modifiers', () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start({ profile: 'full' });
    canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 5, clientY: 6 }));
    const out = rec.stop();
    const e = out.events[0];
    expect(e.type).toBe('pointermove');
    expect(e.clientX).toBe(5);
    expect(e.clientY).toBe(6);
    // Stripped fields:
    expect(Object.prototype.hasOwnProperty.call(e, 'button')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'buttons')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'pointerType')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'pointerId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'altKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'ctrlKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'metaKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'shiftKey')).toBe(false);
  });

  it('modifier fields are included only when truthy', () => {
    const rec = createRecorder({ canvas: () => canvas });
    rec.start({ profile: 'full' });
    canvas.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, clientX: 0, clientY: 0, shiftKey: true,
    }));
    const out = rec.stop();
    const e = out.events[0];
    expect(e.shiftKey).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(e, 'altKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'ctrlKey')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, 'metaKey')).toBe(false);
  });

  it('attaches no listeners outside of start()/stop()', () => {
    const rec = createRecorder({ canvas: () => canvas });
    // Dispatch before start — must not be captured.
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    rec.start();
    rec.stop();
    // Dispatch after stop — also must not be captured.
    canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    // A fresh start records a clean slate.
    rec.start();
    canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const out = rec.stop();
    expect(out.events.map((e) => e.type)).toEqual(['pointerup']);
  });
});
