import { act, fireEvent, render, screen } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { type RefObject, StrictMode, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoupeGestures } from './LoupeGestures';
import { resolveLoupe } from './types';
import { type LoupeState, useLoupe } from './useLoupe';

interface HarnessProps {
  enabled?: boolean;
  peekKey?: string | null;
  sample?: (p: { x: number; y: number }) => string | null;
  minFactor?: number;
  maxFactor?: number;
  onColorChange?: (hex: string) => void;
  seen?: (loupe: LoupeState) => void;
}

/** Reports the loupe's state as text, which is every assertion jsdom can make
 *  about a magnifier — that the lens shows the right region is a screenshot.
 *
 *  Mounts `<LoupeGestures>` the way `<TrialLoupe>` does, so the key and wheel
 *  cases below exercise the real dispatcher route rather than a stand-in. */
function Harness({ enabled = true, seen, sample, ...rest }: HarnessProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const capability = resolveLoupe(rest);
  const loupe = useLoupe({
    hostRef: hostRef as RefObject<HTMLElement | null>,
    enabled,
    sample,
    capability,
  });
  seen?.(loupe);
  return (
    <div ref={hostRef} data-testid="host">
      <WeaselProvider isolate>
        <LoupeGestures
          hostRef={hostRef as RefObject<HTMLElement | null>}
          input={loupe.input}
          peekKey={capability.peekKey ?? null}
        />
      </WeaselProvider>
      <span data-testid="visible">{String(loupe.visible)}</span>
      <span data-testid="aim">{`${loupe.aim.x},${loupe.aim.y}`}</span>
      <span data-testid="factor">{loupe.factor}</span>
      <span data-testid="mode">{loupe.mode}</span>
      <span data-testid="color">{String(loupe.color)}</span>
    </div>
  );
}

const read = (id: string): string => screen.getByTestId(id).textContent ?? '';

/** jsdom lays nothing out, so every rect is 0×0 at the origin and a client
 *  coordinate is already host-relative. */
function move(x: number, y: number): void {
  fireEvent.pointerMove(screen.getByTestId('host'), { clientX: x, clientY: y });
}

describe('useLoupe', () => {
  it('stays hidden until the pointer is over the host', () => {
    render(<Harness />);
    expect(read('visible')).toBe('false');
    move(40, 25);
    expect(read('visible')).toBe('true');
    expect(read('aim')).toBe('40,25');
  });

  it('hides again when the pointer leaves', () => {
    render(<Harness />);
    move(40, 25);
    fireEvent.pointerLeave(screen.getByTestId('host'));
    expect(read('visible')).toBe('false');
  });

  it('ignores the pointer while it is turned off', () => {
    render(<Harness enabled={false} />);
    move(40, 25);
    expect(read('visible')).toBe('false');
  });

  it('peeks while the peek key is held, and stops on release', () => {
    render(<Harness enabled={false} />);
    move(40, 25);
    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' });
    });
    expect(read('visible')).toBe('true');
    act(() => {
      fireEvent.keyUp(window, { key: 'Alt' });
    });
    expect(read('visible')).toBe('false');
  });

  it('does not peek when the capability turned the key off', () => {
    render(<Harness enabled={false} peekKey={null} />);
    move(40, 25);
    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' });
    });
    expect(read('visible')).toBe('false');
  });

  it('drops the peek when the window loses focus, so a held key cannot stick', () => {
    render(<Harness enabled={false} />);
    move(40, 25);
    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' });
    });
    expect(read('visible')).toBe('true');
    act(() => {
      fireEvent.blur(window);
    });
    expect(read('visible')).toBe('false');
  });

  it('opens at the declared factor and zooms on the wheel', () => {
    render(<Harness />);
    move(40, 25);
    expect(read('factor')).toBe('6');
    act(() => {
      fireEvent.wheel(screen.getByTestId('host'), { deltaY: -100 });
    });
    expect(Number(read('factor'))).toBeGreaterThan(6);
  });

  it('clamps the wheel to the declared bounds', () => {
    render(<Harness minFactor={4} maxFactor={8} />);
    move(40, 25);
    for (let i = 0; i < 40; i++) {
      act(() => {
        fireEvent.wheel(screen.getByTestId('host'), { deltaY: -100 });
      });
    }
    expect(Number(read('factor'))).toBe(8);
    for (let i = 0; i < 80; i++) {
      act(() => {
        fireEvent.wheel(screen.getByTestId('host'), { deltaY: 100 });
      });
    }
    expect(Number(read('factor'))).toBe(4);
  });

  it('leaves the wheel to pan-zoom while the lens is not shown', () => {
    render(<Harness enabled={false} />);
    const host = screen.getByTestId('host');
    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    act(() => {
      host.dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('takes the wheel from pan-zoom while the lens is shown', () => {
    render(<Harness />);
    move(40, 25);
    const host = screen.getByTestId('host');
    const wheel = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    act(() => {
      host.dispatchEvent(wheel);
    });
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('stops a claimed wheel reaching the pan-zoom handler above it', () => {
    // The real handler is React's, delegated to the root container, so what
    // decides whether pan-zoom runs is whether the event bubbles past the
    // host — `defaultPrevented` says nothing about that. A listener on an
    // ancestor is the proxy for React's root one.
    const above = vi.fn();
    const { container } = render(<Harness />);
    container.addEventListener('wheel', above);

    const host = screen.getByTestId('host');
    move(40, 25);
    act(() => {
      host.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }),
      );
    });
    expect(above).not.toHaveBeenCalled();

    fireEvent.pointerLeave(host);
    act(() => {
      host.dispatchEvent(
        new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }),
      );
    });
    expect(above).toHaveBeenCalledTimes(1);
  });

  it('leaves the native context menu and file drops to the lab', () => {
    // The dispatcher suppresses `contextmenu` unconditionally and makes its
    // element a drop target; the loupe mounts with both channels off, so a
    // lab that turns a magnifier on keeps its right-click and its drops.
    render(<Harness />);
    const host = screen.getByTestId('host');
    move(40, 25);

    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      host.dispatchEvent(menu);
    });
    expect(menu.defaultPrevented).toBe(false);
    expect(host.classList.contains('weasel-dropover')).toBe(false);
  });

  it('reports the color under the aim', () => {
    const onColorChange = vi.fn();
    render(
      <Harness sample={(p) => (p.x > 10 ? '#ff0000' : '#00ff00')} onColorChange={onColorChange} />,
    );
    move(40, 25);
    expect(read('color')).toBe('#ff0000');
    expect(onColorChange).toHaveBeenCalledWith('#ff0000');
    move(4, 25);
    expect(read('color')).toBe('#00ff00');
  });

  it('picks what the lens shows at a point inside it', () => {
    const seen: LoupeState[] = [];
    render(<Harness sample={(p) => `#${Math.round(p.x)}`} seen={(l) => seen.push(l)} />);
    move(100, 100);
    const loupe = seen[seen.length - 1];
    // Half the default 200px lens right of centre, at 6x, is 100/6 world px
    // right of the aim.
    const hex = loupe.pick({ x: 100 + 100, y: 100 });
    expect(hex).toBe(`#${Math.round(100 + 100 / 6)}`);
  });

  it('still aims after a mount / unmount / remount', () => {
    // What StrictMode does to every effect. The model is created once and
    // `dispose` is one-way, so tearing it down on the first unmount left a
    // magnifier that drew but never moved.
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    move(40, 25);
    expect(read('visible')).toBe('true');
    expect(read('aim')).toBe('40,25');
  });

  it('switches mode', () => {
    const seen: LoupeState[] = [];
    render(<Harness seen={(l) => seen.push(l)} />);
    move(40, 25);
    act(() => {
      seen[seen.length - 1].setMode('pixel');
    });
    expect(read('mode')).toBe('pixel');
  });
});
