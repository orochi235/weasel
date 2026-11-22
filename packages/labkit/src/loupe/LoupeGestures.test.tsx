import { act, fireEvent, render, screen } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { type ReactNode, type RefObject, StrictMode, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CameraContext, type CameraContextValue } from '../canvas/CameraInput';
import { LoupeGestures } from './LoupeGestures';
import { resolveLoupe } from './types';
import { useLoupe } from './useLoupe';

/** A loupe that is off, so only the peek key can raise it. `wrap` puts its
 *  gestures under a provider of the test's choosing. */
function Wall({
  id,
  wrap,
  host,
}: {
  id: string;
  wrap: (children: ReactNode) => ReactNode;
  /** The element the loupe tracks, when not its own wall. */
  host?: RefObject<HTMLElement | null>;
}) {
  const own = useRef<HTMLDivElement | null>(null);
  const hostRef = (host ?? own) as RefObject<HTMLDivElement | null>;
  const options = resolveLoupe({});
  const loupe = useLoupe({
    hostRef: hostRef as RefObject<HTMLElement | null>,
    enabled: false,
    options,
  });
  return (
    <div ref={own} data-testid={id}>
      {wrap(
        <LoupeGestures
          hostRef={hostRef as RefObject<HTMLElement | null>}
          input={loupe.input}
          peekKey={options.peekKey ?? null}
        />,
      )}
      <span data-testid={`${id}-visible`}>{String(loupe.visible)}</span>
    </div>
  );
}

const isolated = (children: ReactNode) => <WeaselProvider isolate>{children}</WeaselProvider>;
const bare = (children: ReactNode) => children;

const visible = (id: string): string => screen.getByTestId(`${id}-visible`).textContent ?? '';

function peek(): void {
  act(() => {
    fireEvent.keyDown(window, { key: 'Alt' });
  });
}

describe('<LoupeGestures> with two loupes on the page', () => {
  it('peeks the loupe under the pointer, though the other was pressed last', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    giveKeys(screen.getByTestId('a'));
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('b')).toBe('true');
    expect(visible('a')).toBe('false');
  });

  it('peeks the loupe under the pointer before anything is pressed', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('b')).toBe('true');
  });

  it('peeks the loupe under the pointer when both register under one provider', () => {
    render(
      <WeaselProvider isolate>
        <Wall id="a" wrap={bare} />
        <Wall id="b" wrap={bare} />
      </WeaselProvider>,
    );
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('a')).toBe('true');
    expect(visible('b')).toBe('false');
  });

  it('peeks a loupe the pointer moves onto with the key already held', () => {
    render(<Wall id="a" wrap={isolated} />);
    giveKeys(screen.getByTestId('a'));
    peek();
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    expect(visible('a')).toBe('true');
  });

  it('carries a held peek from one loupe to the next', () => {
    render(
      <>
        <Wall id="a" wrap={isolated} />
        <Wall id="b" wrap={isolated} />
      </>,
    );
    fireEvent.pointerMove(screen.getByTestId('a'), { clientX: 10, clientY: 10 });
    peek();
    fireEvent.pointerLeave(screen.getByTestId('a'));
    fireEvent.pointerMove(screen.getByTestId('b'), { clientX: 10, clientY: 10 });
    expect(visible('a')).toBe('false');
    expect(visible('b')).toBe('true');
  });
});

describe('<LoupeGestures> with two loupes in one camera', () => {
  const cameraEl = { current: null as HTMLElement | null };
  const attachCamera = (el: HTMLElement | null) => {
    cameraEl.current = el;
  };
  const camera = { element: () => cameraEl.current } as CameraContextValue;
  const inCamera = (children: ReactNode) => (
    <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>
  );

  it('warns that only the newest one will take the camera’s input', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = render(
      <WeaselProvider isolate>
        <div ref={attachCamera}>
          <Wall id="a" wrap={inCamera} host={cameraEl} />
          <Wall id="b" wrap={inCamera} host={cameraEl} />
        </div>
      </WeaselProvider>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/two loupes/);
    unmount();
    warn.mockRestore();
  });

  it('does not warn for one loupe, remounted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tree = (
      <WeaselProvider isolate>
        <div ref={attachCamera}>
          <Wall id="a" wrap={inCamera} host={cameraEl} />
        </div>
      </WeaselProvider>
    );
    const { rerender, unmount } = render(<StrictMode>{tree}</StrictMode>);
    rerender(<StrictMode>{tree}</StrictMode>);
    expect(warn).not.toHaveBeenCalled();
    unmount();
    warn.mockRestore();
  });
});

describe('<LoupeGestures> on a pane inside a camera', () => {
  it('listens on its own host, not on the camera’s element', () => {
    const cameraEl = { current: null as HTMLElement | null };
    const attachCamera = (el: HTMLElement | null) => {
      cameraEl.current = el;
    };
    const camera = { element: () => cameraEl.current } as CameraContextValue;
    render(
      <WeaselProvider isolate>
        <div ref={attachCamera} data-testid="camera">
          <Wall
            id="pane"
            wrap={(children) => (
              <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>
            )}
          />
        </div>
      </WeaselProvider>,
    );
    fireEvent.pointerMove(screen.getByTestId('pane'), { clientX: 10, clientY: 10 });
    peek();
    expect(visible('pane')).toBe('true');
  });

  it('does not count two panes as two loupes in the camera', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cameraEl = { current: null as HTMLElement | null };
    const camera = { element: () => cameraEl.current } as CameraContextValue;
    const inCamera = (children: ReactNode) => (
      <CameraContext.Provider value={camera}>{children}</CameraContext.Provider>
    );
    const { unmount } = render(
      <WeaselProvider isolate>
        <div
          ref={(el) => {
            cameraEl.current = el;
          }}
        >
          <Wall id="p" wrap={inCamera} />
          <Wall id="q" wrap={inCamera} />
        </div>
      </WeaselProvider>,
    );
    expect(warn).not.toHaveBeenCalled();
    unmount();
    warn.mockRestore();
  });
});
