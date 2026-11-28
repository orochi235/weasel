/**
 * Whose scope a press, a wheel or a right-click activates: the dispatcher that handles it, and of two on one
 * surface, the first that takes keys gets them.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef, type ReactNode, type RefObject } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import type { UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import type { ActionsRegistry } from '../actions/registry';

afterEach(cleanup);

type Opts = Pick<UseGestureDispatcherOptions, 'keyboard' | 'channels'>;

function On({ surface, opts, seen }: { surface: RefObject<HTMLElement | null>; opts: Opts; seen: (r: ActionsRegistry) => void }): null {
  const registry = useActionsRegistry()!;
  seen(registry);
  useGestureDispatcher({ canvasRef: surface, actions: registry, entriesById: new Map(), ...opts });
  return null;
}

function Scope({ children }: { children: ReactNode }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

/** Two dispatchers: `a` on the outer div, `b` on the inner canvas, or both on the canvas with `shared`. */
function mount(a: Opts, b: Opts, shared = false) {
  const registries: Partial<Record<'a' | 'b', ActionsRegistry>> = {};
  function Mount(): ReactNode {
    const outerRef = useRef<HTMLDivElement | null>(null);
    const innerRef = useRef<HTMLCanvasElement | null>(null);
    return (
      <div ref={outerRef}>
        <Scope><On surface={shared ? innerRef : outerRef} opts={a} seen={(r) => { registries.a = r; }} /></Scope>
        <Scope><On surface={innerRef} opts={b} seen={(r) => { registries.b = r; }} /></Scope>
        <canvas ref={innerRef} />
      </div>
    );
  }
  render(<Mount />);
  const fire = (e: Event): void => { act(() => { document.querySelector('canvas')!.dispatchEvent(e); }); };
  return { a: registries.a!, b: registries.b!, fire };
}

const press = () => new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, button: 0, buttons: 1 });
const wheel = () => new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 1 });
const menu = () => new MouseEvent('contextmenu', { bubbles: true, cancelable: true });

describe('the scope an event activates', () => {
  it('takes the keys for a keyboard-on dispatcher sharing a surface with a keyboard-off one attached first', () => {
    const { b, fire } = mount({ keyboard: false }, {}, true);
    fire(press());
    expect(b.holdsKeys()).toBe(true);
  });

  it("is the outer surface's for a press in a nested surface whose pointer channel is off", () => {
    const { a, fire } = mount({}, { channels: { pointer: false } });
    fire(press());
    expect(a.holdsKeys()).toBe(true);
  });

  it("is the outer surface's for a wheel in a nested surface whose wheel channel is off", () => {
    const { a, fire } = mount({}, { channels: { wheel: false } });
    fire(wheel());
    expect(a.holdsKeys()).toBe(true);
  });

  it("is the outer surface's for a right-click in a nested surface whose menu channel is off", () => {
    const { a, fire } = mount({}, { channels: { contextMenu: false } });
    fire(menu());
    expect(a.holdsKeys()).toBe(true);
  });

  it('is still the nested surface that runs the channel', () => {
    const { b, fire } = mount({}, {});
    fire(press());
    expect(b.holdsKeys()).toBe(true);
  });
});
