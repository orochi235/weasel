import { act, fireEvent, render, screen } from '@testing-library/react';
import { WeaselProvider } from '@weasel-js/core';
import { renderThenAbandon } from '@weasel-js/react/testing/abandonRender';
import { type RefObject, StrictMode, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoupeGestures } from './LoupeGestures';
import { type LoupeOptions, type LoupeShape, resolveLoupe } from './types';
import { type LoupeState, useLoupe } from './useLoupe';

interface HarnessProps {
  enabled?: boolean;
  peekKey?: string | null;
  sample?: (p: { x: number; y: number }) => string | null;
  minFactor?: number;
  maxFactor?: number;
  onColorChange?: (hex: string) => void;
  shape?: LoupeShape;
  place?: LoupeOptions['place'];
  seen?: (loupe: LoupeState) => void;
}

/** Reports the loupe's state as text, which is every assertion jsdom can make
 *  about a magnifier — that the lens shows the right region is a screenshot.
 *
 *  Mounts `<LoupeGestures>` the way `<TrialLoupe>` does, so the key and wheel
 *  cases below exercise the real dispatcher route rather than a stand-in. */
function Harness({ enabled = true, seen, sample, ...rest }: HarnessProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const options = resolveLoupe(rest);
  const loupe = useLoupe({
    hostRef: hostRef as RefObject<HTMLElement | null>,
    enabled,
    sample,
    options,
  });
  seen?.(loupe);
  return (
    <div ref={hostRef} data-testid="host">
      <WeaselProvider isolate>
        <LoupeGestures
          hostRef={hostRef as RefObject<HTMLElement | null>}
          input={loupe.input}
          peekKey={options.peekKey ?? null}
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

  it('opens a peek where the pointer already is', () => {
    // The model ignores aims while the lens is down, so a peek over a pointer
    // that has not moved since must aim from what the listener saw.
    render(<Harness enabled={false} />);
    move(40, 25);
    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' });
    });
    expect(read('aim')).toBe('40,25');
  });

  it('opens where the pointer already is when turned on', () => {
    const { rerender } = render(<Harness enabled={false} />);
    move(40, 25);
    rerender(<Harness enabled />);
    expect(read('visible')).toBe('true');
    expect(read('aim')).toBe('40,25');
  });

  it('does not peek when its options turned the key off', () => {
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

  it('aims as the committed `enabled` allows, not an abandoned render', () => {
    const seen: LoupeState[] = [];
    // Reads the aim back through the model: the DOM is not re-rendered while
    // the abandoned transition is still pending.
    const aimOf = (p: { x: number; y: number }) => `${p.x},${p.y}`;
    renderThenAbandon({ enabled: false }, { enabled: true }, (p) => (
      <Harness enabled={p.enabled} sample={aimOf} seen={(l) => seen.push(l)} />
    ));
    const before = seen[0]?.pick();
    move(40, 25);
    expect(seen[0]?.pick()).toBe(before);
  });

  it('samples through the committed `sample`, not an abandoned render', () => {
    const seen: LoupeState[] = [];
    const committed = vi.fn(() => '#111111');
    const abandoned = vi.fn(() => '#222222');
    renderThenAbandon({ sample: committed }, { sample: abandoned }, (p) => (
      <Harness sample={p.sample} seen={(l) => seen.push(l)} />
    ));
    expect(seen[0]?.pick()).toBe('#111111');
    expect(abandoned).not.toHaveBeenCalled();
  });

  describe('placed by the host', () => {
    const last = (seen: LoupeState[]): LoupeState => seen[seen.length - 1] as LoupeState;

    it('is a diameter box on the aim, at the wheel factor, when nothing places it', () => {
      const seen: LoupeState[] = [];
      render(<Harness seen={(l) => seen.push(l)} />);
      move(40, 30);
      expect(last(seen).lens).toEqual({
        center: { x: 40, y: 30 }, shows: { x: 40, y: 30 }, width: 200, height: 200, factor: 6, shape: 'circle',
      });
    });

    it('asks place with the aim and the wheel factor, and draws the box it returns', () => {
      const seen: LoupeState[] = [];
      const place = vi.fn(({ aim }: { aim: { x: number; y: number } }) => ({
        center: { x: 150, y: Math.floor(aim.y / 20) * 20 + 10 },
        width: 300,
        height: 60,
      }));
      render(<Harness shape="square" place={place} seen={(l) => seen.push(l)} />);
      move(40, 33);
      expect(place).toHaveBeenLastCalledWith({ aim: { x: 40, y: 33 }, factor: 6 });
      expect(last(seen).lens).toEqual({
        center: { x: 150, y: 30 }, shows: { x: 150, y: 30 }, width: 300, height: 60, factor: 6, shape: 'square',
      });
    });

    it('draws a placement at its center while showing the point it names', () => {
      const seen: LoupeState[] = [];
      render(
        <Harness
          place={() => ({ center: { x: 50, y: 20 }, shows: { x: 10, y: 20 }, width: 100, height: 40 })}
          seen={(l) => seen.push(l)}
        />,
      );
      move(10, 20);
      expect(last(seen).lens).toMatchObject({ center: { x: 50, y: 20 }, shows: { x: 10, y: 20 } });
    });

    it('shows at the factor place returns, leaving the wheel factor as what place is asked with', () => {
      const seen: LoupeState[] = [];
      const place = vi.fn(({ factor }: { factor: number }) => ({
        center: { x: 0, y: 0 }, width: 100, height: 20, factor: Math.min(factor, 2.5),
      }));
      render(<Harness place={place} seen={(l) => seen.push(l)} />);
      move(10, 10);
      expect(last(seen).lens.factor).toBe(2.5);
      expect(last(seen).factor).toBe(6);
    });

    it('falls back to the diameter box when place returns null', () => {
      const seen: LoupeState[] = [];
      render(<Harness place={() => null} seen={(l) => seen.push(l)} />);
      move(40, 30);
      expect(last(seen).lens).toMatchObject({ center: { x: 40, y: 30 }, width: 200, height: 200 });
    });

    it('does not ask place while the lens is down', () => {
      const place = vi.fn(() => null);
      render(<Harness enabled={false} place={place} />);
      move(40, 30);
      expect(place).not.toHaveBeenCalled();
    });

    it('picks what a placed lens shows, about its own center and factor', () => {
      const seen: LoupeState[] = [];
      render(
        <Harness
          sample={(p) => `#${Math.round(p.x)}`}
          place={() => ({ center: { x: 300, y: 50 }, width: 400, height: 40, factor: 2 })}
          seen={(l) => seen.push(l)}
        />,
      );
      move(100, 50);
      // 100px right of the lens's middle, at 2x, is 50 page px right of the
      // center it shows — not of the aim.
      expect(last(seen).pick({ x: 300 + 100, y: 50 })).toBe('#350');
      // The color under the aim is still the aim's.
      expect(read('color')).toBe('#100');
    });
  });
});
