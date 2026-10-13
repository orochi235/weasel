import { describe, it, expect, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { useGestureDispatcher } from './useGestureDispatcher';

function Harness({ children }: { children: React.ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActiveToolContextProvider>
        <ActionsProvider>
          {children}
        </ActionsProvider>
      </ActiveToolContextProvider>
    </DepRegistryProvider>
  );
}

describe('useGestureDispatcher — controls inside the host', () => {
  function HostProbe() {
    const registry = useActionsRegistry();
    const hostRef = useRef<HTMLDivElement | null>(null);
    useGestureDispatcher({
      canvasRef: hostRef as unknown as React.RefObject<HTMLCanvasElement | null>,
      actions: registry!,
      entriesById: new Map(),
    });
    return (
      <div ref={hostRef} data-testid="host">
        <button type="button">control</button>
        <span>content</span>
      </div>
    );
  }

  // Proxy: jsdom's setPointerCapture changes nothing, so the click a browser
  // would retarget to the host cannot be observed here. What can be is whether
  // the dispatcher asked for capture at all — in a browser, asking is what
  // takes the click away from the button.
  it('leaves a press on a control to the control, and takes one on content', () => {
    const { getByTestId, getByText } = render(<Harness><HostProbe /></Harness>);
    const host = getByTestId('host');
    const capture = vi.fn();
    host.setPointerCapture = capture;
    act(() => {
      getByText('control').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0 }));
    });
    expect(capture).not.toHaveBeenCalled();
    act(() => {
      getByText('content').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2, button: 0 }));
    });
    expect(capture).toHaveBeenCalledWith(2);
  });
});
