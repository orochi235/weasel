/**
 * Property test of a mounted dispatcher across input devices: a mouse, a finger, and a pen, tapping, dragging or
 * holding with any modifiers held, and a keystroke with any modifiers. A spec names no device, so each fires by the
 * gesture alone: a press for every primary press, a click for a tap, a drag for a press that travels, a long-press
 * for a held touch or pen, and nothing bound without modifiers when one is held.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { LONG_PRESS_MS, type GestureSpec } from '@weasel-js/gestures';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { Action } from '../actions/action';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { useGestureDispatcher } from './useGestureDispatcher';

beforeAll(() => {
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn();
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

type Device = 'mouse' | 'touch' | 'pen';
type Motion = 'tap' | 'drag' | 'hold' | 'key';
interface Mods { altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }

const SPECS: Record<string, GestureSpec> = {
  press: { kind: 'pointerDown' },
  click: { kind: 'click' },
  drag: { kind: 'drag' },
  longPress: { kind: 'longPress' },
  key: { kind: 'key', key: 'k' },
};

function mount(fired: string[]): HTMLCanvasElement {
  const actions = Object.entries(SPECS).map(([id, spec]): Action => (spec.kind === 'drag'
    ? { id, label: id, defaultBinding: spec, invoker: { timing: 'ongoing', start: () => ({ onEnd: () => { fired.push(id); } }) } }
    : { id, label: id, defaultBinding: spec, invoker: { timing: 'immediate', run: () => { fired.push(id); } } }));
  function Mount(): ReactNode {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const registry = useActionsRegistry()!;
    for (const a of actions) registry.register(a);
    useGestureDispatcher({ canvasRef, actions: registry, entriesById: new Map(), claimKeys: true, classifyTarget: () => ({ body: 'empty' }) });
    return <canvas ref={canvasRef} data-testid="devices" />;
  }
  render(
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider><Mount /></ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>,
  );
  return document.querySelector<HTMLCanvasElement>('[data-testid="devices"]')!;
}

function perform(canvas: HTMLCanvasElement, device: Device, motion: Motion, mods: Mods): void {
  if (motion === 'key') {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true, ...mods }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'k', bubbles: true, ...mods }));
    });
    return;
  }
  const fire = (type: string, x: number) => act(() => {
    canvas.dispatchEvent(new PointerEvent(type, {
      bubbles: true, pointerType: device, pointerId: 1, isPrimary: true, button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: 10, ...mods,
    }));
  });
  fire('pointerdown', 10);
  if (motion === 'drag') { fire('pointermove', 40); fire('pointermove', 80); }
  if (motion === 'hold') act(() => { vi.advanceTimersByTime(LONG_PRESS_MS + 50); });
  fire('pointerup', motion === 'drag' ? 80 : 10);
  act(() => { vi.advanceTimersByTime(1000); });
}

/** What the specs say fires: each binding names a gesture, never a device, and holds no modifier. */
function expected(device: Device, motion: Motion, mods: Mods): string[] {
  if (mods.altKey || mods.ctrlKey || mods.metaKey || mods.shiftKey) return [];
  if (motion === 'key') return ['key'];
  if (motion === 'drag') return ['press', 'drag'];
  if (motion === 'hold' && device !== 'mouse') return ['press', 'longPress'];
  return ['press', 'click'];
}

const NONE: Mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const mods: fc.Arbitrary<Mods> = fc.oneof(
  { weight: 2, arbitrary: fc.constant(NONE) },
  fc.record({ altKey: fc.boolean(), ctrlKey: fc.boolean(), metaKey: fc.boolean(), shiftKey: fc.boolean() }),
);

describe('every device routes as the spec says', () => {
  it('fires the binding for the gesture made, whichever device made it, and none bound bare under a modifier', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.constantFrom<Device>('mouse', 'touch', 'pen'), fc.constantFrom<Motion>('tap', 'drag', 'hold', 'key'), mods,
      (device, motion, held) => {
        cleanup();
        const fired: string[] = [];
        const canvas = mount(fired);
        perform(canvas, device, motion, held);
        expect([...fired].sort()).toEqual(expected(device, motion, held).sort());
        t.hit(`${device} ${motion}`);
        if (held !== NONE && expected(device, motion, held).length === 0) t.hit('modified');
      },
    ), runs(120));
    t.expectHit('touch hold', 'pen hold', 'mouse hold', 'pen drag', 'touch tap', 'mouse drag', 'modified');
  }, timeoutFor(120, 40));
});
