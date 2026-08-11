/**
 * Integration tests for `useEyedropperTool` through the gesture dispatcher,
 * mirroring the way apps/draw wires it: registry-active (sticky `I`) and
 * hotkey-engaged (alt-hold), with a `nodeAtPoint` dep standing in for the
 * scene picker `<SceneCanvas>` sources.
 *
 * These walk the real pointerdown → pointerup path, which is what makes them
 * worth having: the tool declares one `click` binding and nothing else, so
 * everything about *when* it samples — sub-threshold release, hotkey scope
 * outranking the active tool — lives in the dispatcher rather than in the
 * tool. The unit tests next door drive its action directly.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from 'interactions/actions/registry';
import { DepRegistryProvider, useDepRegistry } from 'interactions/actions/depRegistry';
import 'interactions/actions/depSchema';
import {
  ActiveToolContextProvider,
  useActiveToolContext,
  type ActiveToolContextValue,
} from 'interactions/actions/activeToolContext';
import { useGestureDispatcher } from 'interactions/dispatcher/useGestureDispatcher';
import { useEyedropperTool, type UseEyedropperToolOptions } from './useEyedropperTool';
import type { Tool } from '../../types';
import type { NodeId } from 'core/scene/types';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function fire(el: Element, type: string, init: PointerEventInit = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...init }));
}

/** A second tool whose click binding would win if scope priority didn't put
 *  the hotkey-engaged eyedropper first. */
const RIVAL_ID = 'rival';

function makeRival(): Tool<null> {
  return {
    id: RIVAL_ID,
    eligibility: { focus: true },
    bindings: [{ spec: { kind: 'click' }, actionId: 'rival.click' }],
  };
}

function Mount({
  options,
  hitId,
  rivalSpy,
}: {
  options: UseEyedropperToolOptions;
  hitId: string | null;
  rivalSpy?: () => void;
}) {
  const registry = useActionsRegistry();
  const deps = useDepRegistry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eyedropper = useEyedropperTool(options);

  deps.register('nodeAtPoint', () => () => (hitId === null ? null : (hitId as NodeId)));
  for (const action of eyedropper.actions ?? []) registry?.register(action);
  if (rivalSpy) {
    registry?.register({
      id: 'rival.click',
      label: 'rival',
      invoker: { timing: 'immediate', run: () => rivalSpy() },
    });
  }

  const toolsById = new Map<string, Tool>([
    ['eyedropper', eyedropper as unknown as Tool],
    ...(rivalSpy ? ([[RIVAL_ID, makeRival() as Tool]] as const) : []),
  ]);

  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    toolsById,
    enabled: true,
    classifyTarget: () => ({ body: 'empty' }),
  });
  return <canvas ref={canvasRef} />;
}

function Harness({
  children,
  initialActive = 'eyedropper',
}: {
  children: React.ReactNode;
  initialActive?: string;
}) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider initialActive={initialActive}>
        <ActionsProvider>{children}</ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

describe('useEyedropperTool through the gesture dispatcher', () => {
  it('active-slot click on a node samples its color', () => {
    const onPick = vi.fn();
    const { container } = render(
      <Harness>
        <Mount options={{ onPick, colorOf: () => '#7fb069' }} hitId="r1" />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10 }); });
    expect(onPick).toHaveBeenCalledExactlyOnceWith('#7fb069');
  });

  it('a press that turns into a drag does not sample', () => {
    // v1 is click-only. The click is synthesized only on a sub-threshold
    // release, so crossing the drag threshold suppresses it.
    const onPick = vi.fn();
    const { container } = render(
      <Harness>
        <Mount options={{ onPick, colorOf: () => '#7fb069' }} hitId="r1" />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 60, clientY: 60 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 60, clientY: 60 }); });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('click on empty canvas samples nothing', () => {
    const onPick = vi.fn();
    const { container } = render(
      <Harness>
        <Mount options={{ onPick, colorOf: () => '#7fb069' }} hitId={null} />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10 }); });
    expect(onPick).not.toHaveBeenCalled();
  });

  it('hotkey-engaged eyedropper outranks the active tool without a claim gate', () => {
    // The old implementation carried a pointerDown route that returned
    // `claim()` purely to pre-empt useSelectTool's always-claiming pointerdown
    // route on the *other* dispatch pipeline. With one dispatcher, hotkey
    // scope beats active scope and the gate is unnecessary.
    const onPick = vi.fn();
    const rivalSpy = vi.fn();
    let ctx!: ActiveToolContextValue;
    function CtxCapture() { ctx = useActiveToolContext(); return null; }
    const { container } = render(
      <Harness initialActive={RIVAL_ID}>
        <Mount options={{ onPick, colorOf: () => '#7fb069' }} hitId="r1" rivalSpy={rivalSpy} />
        <CtxCapture />
      </Harness>,
    );
    const canvas = container.querySelector('canvas')!;

    // Rival is active and alone: it takes the click.
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10 }); });
    expect(rivalSpy).toHaveBeenCalledTimes(1);
    expect(onPick).not.toHaveBeenCalled();

    // Engage the eyedropper in the hotkey slot: it now wins the same click.
    act(() => { ctx.pushHotkey('eyedropper'); });
    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 10 }); });
    expect(onPick).toHaveBeenCalledExactlyOnceWith('#7fb069');
    expect(rivalSpy).toHaveBeenCalledTimes(1);
  });
});
