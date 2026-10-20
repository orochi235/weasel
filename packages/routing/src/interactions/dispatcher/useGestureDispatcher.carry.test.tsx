/**
 * useGestureDispatcher — the carry channel: a press opened on another element
 * with `startCarry` and released over the canvas reaches the canvas's bindings.
 * Pointer capture is a jsdom no-op, so whether the canvas's own pointer
 * listeners stay quiet is for `carry.browser.test.tsx` to say.
 */
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { ActionDisabledReason, type Action } from '../actions/action';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import type { BodyClassification } from '@weasel-js/gestures';
import type { DispatcherChannels } from './gestureDispatcherOptions';
import { startCarry } from '../carry';
import { useGestureDispatcher } from './useGestureDispatcher';

function Probe({ actions, channels, classifyTarget }: {
  actions: Action[];
  channels?: DispatcherChannels;
  classifyTarget?: (w: { x: number; y: number }) => BodyClassification;
}) {
  const registry = useActionsRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  for (const a of actions) registry?.register(a);
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    clientToWorld: (x, y) => ({ x: x - 100, y: y - 100 }),
    channels,
    classifyTarget,
  });
  return <canvas ref={canvasRef} />;
}

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>{children}</ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

const original = HTMLElement.prototype.getBoundingClientRect;
beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this instanceof HTMLCanvasElement) {
      return { x: 100, y: 100, left: 100, top: 100, right: 300, bottom: 300, width: 200, height: 200, toJSON: () => ({}) } as DOMRect;
    }
    return original.call(this);
  };
});
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = original;
});

const PAYLOAD = { type: 'lab/part', value: { id: 'a' } };

function source(): HTMLElement {
  const el = document.createElement('button');
  document.body.appendChild(el);
  return el;
}

function move(type: string, x: number, y: number): void {
  act(() => {
    document.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, buttons: 1, clientX: x, clientY: y }));
  });
}

function carryFrom(el: HTMLElement, cb?: Parameters<typeof startCarry>[3]) {
  return startCarry(el, new PointerEvent('pointerdown', { pointerId: 1, buttons: 1, clientX: 0, clientY: 0 }), PAYLOAD, cb);
}

describe('useGestureDispatcher — carry channel', () => {
  it('a release over the canvas fires its carry binding at the world point', () => {
    const run = vi.fn();
    render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'immediate', run } }]} /></Harness>);
    const onEnd = vi.fn();
    carryFrom(source(), { onEnd });
    move('pointermove', 50, 50);
    move('pointerup', 150, 160);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0]![1]).toMatchObject({ worldX: 50, worldY: 60, carry: PAYLOAD });
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ taken: true }));
  });

  it('a release anywhere else fires nothing and is not taken', () => {
    const run = vi.fn();
    render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'immediate', run } }]} /></Harness>);
    const onEnd = vi.fn();
    carryFrom(source(), { onEnd });
    move('pointermove', 150, 150);
    move('pointerup', 20, 20);
    expect(run).not.toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledWith(expect.objectContaining({ taken: false }));
  });

  it('follows an ongoing binding over the canvas and cancels it as the carry leaves', () => {
    const onMove = vi.fn();
    const onEnd = vi.fn();
    const start = vi.fn(() => ({ onMove, onEnd }));
    render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'ongoing', start } }]} /></Harness>);
    carryFrom(source());
    move('pointermove', 150, 150);
    expect(start).toHaveBeenCalledOnce();
    move('pointermove', 160, 150);
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ world: { x: 60, y: 50 } }));
    move('pointermove', 20, 20);
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
    move('pointermove', 150, 150);
    move('pointerup', 150, 150);
    expect(start).toHaveBeenCalledTimes(2);
    expect(onEnd).toHaveBeenLastCalledWith(expect.anything(), 'commit');
  });

  it('a canceled press cancels the handle over the canvas', () => {
    const onEnd = vi.fn();
    render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'ongoing', start: () => ({ onEnd }) } }]} /></Harness>);
    const c = carryFrom(source());
    move('pointermove', 150, 150);
    act(() => c.cancel());
    expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'cancel');
  });

  it('with the carry channel off the canvas is no surface', () => {
    const run = vi.fn();
    render(<Harness><Probe channels={{ carry: false }} actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'immediate', run } }]} /></Harness>);
    carryFrom(source());
    move('pointerup', 150, 150);
    expect(run).not.toHaveBeenCalled();
  });

  it('stops being a surface when it unmounts', () => {
    const run = vi.fn();
    const { unmount } = render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, invoker: { timing: 'immediate', run } }]} /></Harness>);
    unmount();
    carryFrom(source());
    move('pointerup', 150, 150);
    expect(run).not.toHaveBeenCalled();
  });

  describe('over a target', () => {
    // World x in 50..100 is a selected body; everywhere else is empty.
    const classify = (w: { x: number; y: number }): BodyClassification =>
      (w.x >= 50 && w.x <= 100 ? { body: 'selected-body', kind: 'rect' } : { body: 'empty' });

    it('fires an immediate binding only when released over its target', () => {
      const run = vi.fn();
      const action: Action = { id: 'tag', label: 'Tag', defaultBinding: { kind: 'carry', target: 'selected-body' }, invoker: { timing: 'immediate', run } };
      render(<Harness><Probe classifyTarget={classify} actions={[action]} /></Harness>);
      carryFrom(source());
      move('pointermove', 120, 120);
      move('pointerup', 120, 120);
      expect(run).not.toHaveBeenCalled();
      carryFrom(source());
      move('pointermove', 120, 120);
      move('pointerup', 170, 120);
      expect(run).toHaveBeenCalledOnce();
      expect(run.mock.calls[0]![1]).toMatchObject({ worldX: 70, bodyTarget: 'selected-body', carry: PAYLOAD });
    });

    it('starts an ongoing binding when the carry moves onto its target, not where it came over', () => {
      const onEnd = vi.fn();
      const start = vi.fn(() => ({ onEnd }));
      const action: Action = { id: 'link', label: 'Link', defaultBinding: { kind: 'carry', target: 'selected-body' }, invoker: { timing: 'ongoing', start } };
      render(<Harness><Probe classifyTarget={classify} actions={[action]} /></Harness>);
      carryFrom(source());
      move('pointermove', 110, 110);
      expect(start).not.toHaveBeenCalled();
      move('pointermove', 160, 110);
      expect(start).toHaveBeenCalledOnce();
      move('pointermove', 170, 110);
      expect(start).toHaveBeenCalledOnce();
      move('pointerup', 170, 110);
      expect(onEnd).toHaveBeenCalledWith(expect.anything(), 'commit');
    });
  });

  it("hands the carry's payload to `enabled`, which can refuse it", () => {
    const run = vi.fn();
    const enabled: NonNullable<Action['enabled']> = vi.fn((_d, _at, carried) =>
      ((carried?.carry?.value as { id: string } | undefined)?.id === 'b' ? true : ActionDisabledReason.NotApplicable));
    render(<Harness><Probe actions={[{ id: 'place', label: 'Place', defaultBinding: { kind: 'carry' }, enabled, invoker: { timing: 'immediate', run } }]} /></Harness>);
    carryFrom(source());
    move('pointerup', 150, 150);
    expect(enabled).toHaveBeenCalledWith(expect.anything(), { x: 50, y: 50 }, { items: [], carry: PAYLOAD });
    expect(run).not.toHaveBeenCalled();
  });
});
