import { useEffect, useRef, useState, type ReactElement } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { grownSince, installLeakProbe, type LeakProbe } from '@weasel-js/react/testing/leakProbe';
import { domResidue } from '@weasel-js/react/testing/domResidue';
import {
  useCanvasFocus,
  useElapsed,
  useElapsedRaf,
  useMediaQuery,
  useNearViewport,
  usePrefersReducedMotion,
  useSystemColorScheme,
  useVisibleRaf,
  useWindowEvent,
  watchColorScheme,
  watchElementMove,
  watchMedia,
  watchResize,
} from '@weasel-js/react';
import {
  createKeyState,
  createScene,
  IDENTITY_POSE_COMPOSITION,
  SceneCanvas,
  useCanvasSize,
  useDecayLoop,
  useDragGesture,
  useHoverTracking,
  useKeyModifiers,
  useKeyState,
  usePointerStylus,
  useViewAnimation,
  WeaselProvider,
} from './index';

// The main hooks and canvases of core and @weasel-js/react, each mounted, poked, unmounted and flushed twice: the
// first pass lets a module install what it keeps for good, and the second must leave no more registered, and no
// more DOM, than it found. Then the imperative watchers, each disposed.

const scene = () => createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });

function Box({ use }: { use: (el: { current: HTMLDivElement | null }) => void }): ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  use(ref);
  return <div ref={ref} tabIndex={0} />;
}

const hook = (use: (el: { current: HTMLDivElement | null }) => void) => () => <Box use={use} />;

const cases: [string, () => ReactElement][] = [
  ['SceneCanvas, sized', () => <WeaselProvider><SceneCanvas scene={scene()} layers={{}} width={400} height={300} /></WeaselProvider>],
  ['SceneCanvas, filling its host', () => <WeaselProvider><div><SceneCanvas scene={scene()} layers={{}} /></div></WeaselProvider>],
  ['useKeyState', hook(() => { useKeyState(); })],
  ['useKeyState, scoped to an element', hook((el) => { useKeyState({ target: el }); })],
  ['useKeyModifiers', hook(() => { useKeyModifiers(); })],
  ['usePointerStylus', hook((el) => { usePointerStylus(el); })],
  ['useHoverTracking', () => {
    function Host(): ReactElement {
      const { canvasRef } = useHoverTracking({ nodeAtClientPoint: () => ({ id: 'a' }) });
      return <div ref={canvasRef} />;
    }
    return <Host />;
  }],
  ['useDragGesture, mid-drag', hook(() => {
    const drag = useDragGesture({});
    useEffect(() => {
      drag.start({ x: 0, y: 0 } as never, {} as never);
      drag.move({ x: 30, y: 30 } as never, {} as never);
    }, [drag]);
  })],
  ['useCanvasSize', hook((el) => { useCanvasSize(el); })],
  ['useDecayLoop, coasting', hook(() => {
    const loop = useDecayLoop();
    useEffect(() => { loop.start({ velocity: { vx: 5, vy: 5 }, onTick: () => {} }); }, [loop]);
  })],
  ['useViewAnimation, animating', hook(() => {
    const [view] = useState(() => {
      let v = { x: 0, y: 0, scale: 1 };
      return { get: () => v as never, set: (next: never) => { v = next; } };
    });
    const anim = useViewAnimation(view);
    useEffect(() => { anim.animate({ x: 100, y: 0, scale: 2 } as never); }, [anim]);
  })],
  ['useCanvasFocus', () => {
    function Host(): ReactElement {
      const { focusProps } = useCanvasFocus();
      return <canvas {...focusProps} />;
    }
    return <Host />;
  }],
  ['useNearViewport', hook((el) => { useNearViewport(el, '100px'); })],
  ['useMediaQuery', hook(() => { useMediaQuery('(min-width: 600px)'); })],
  ['usePrefersReducedMotion', hook(() => { usePrefersReducedMotion(); })],
  ['useSystemColorScheme', hook(() => { useSystemColorScheme(); })],
  ['useWindowEvent', hook(() => { useWindowEvent('resize', () => {}); })],
  ['useVisibleRaf, running', hook(() => {
    const loop = useVisibleRaf((_, self) => self.request());
    useEffect(() => { loop.request(); }, [loop]);
  })],
  ['useVisibleRaf, on a target', hook((el) => {
    const loop = useVisibleRaf((_, self) => self.request(), { target: el });
    useEffect(() => { loop.request(); }, [loop]);
  })],
  ['useElapsed', hook(() => { useElapsed(); })],
  ['useElapsedRaf', hook(() => {
    const loop = useElapsedRaf((_, self) => self.request());
    useEffect(() => { loop.request(); }, [loop]);
  })],
];

/** Hover, focus, press and drag every element in `root`, then wheel and type at the first. */
function poke(root: HTMLElement): void {
  const els = [...root.querySelectorAll<HTMLElement>('*')].slice(0, 4);
  for (const el of els) {
    act(() => {
      const at = { clientX: 10, clientY: 10, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1 };
      fireEvent.pointerOver(el, at);
      fireEvent.pointerEnter(el, at);
      fireEvent.pointerMove(el, at);
      el.focus();
      fireEvent.keyDown(el, { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
      fireEvent.keyDown(window, { key: ' ', code: 'Space' });
      fireEvent.pointerDown(el, at);
      fireEvent.pointerMove(el, { ...at, clientX: 60, clientY: 40 });
      fireEvent.pointerMove(el, { ...at, clientX: 399, clientY: 299 });
      fireEvent.wheel(el, { deltaY: 40, clientX: 30, clientY: 30 });
    });
  }
  // Unmount mid-gesture: a pointer still down and a key still held are when a release goes missing.
}

let probe: LeakProbe;
beforeAll(() => {
  probe = installLeakProbe();
});
afterAll(() => probe.restore());

async function cycle(ui: () => ReactElement): Promise<void> {
  const host = document.body.appendChild(document.createElement('div'));
  const Ui = ui;
  const view = render(<Ui />, { container: host });
  await act(async () => {});
  poke(host);
  await act(async () => {});
  view.unmount();
  host.remove();
  probe.flush();
  await act(async () => {});
  probe.flush();
}

describe('every hook and canvas releases what it registered once unmounted', () => {
  it.each(cases)('%s', async (_, ui) => {
    await cycle(ui);
    const before = probe.live();
    const dom = domResidue();
    await cycle(ui);
    expect(grownSince(before, probe.live())).toEqual([]);
    expect(domResidue()).toEqual(dom);
  });
});

const made: HTMLElement[] = [];
const el = () => {
  const div = document.body.appendChild(document.createElement('div'));
  made.push(div);
  return div;
};

const watchers: [string, () => () => void][] = [
  ['watchResize', () => watchResize(el(), () => {})],
  ['watchElementMove', () => watchElementMove(el(), () => {})],
  ['watchMedia', () => watchMedia('(min-width: 600px)', () => {})],
  ['watchColorScheme', () => watchColorScheme(() => {})],
  ['KeyState.attach, window', () => createKeyState().attach(window)],
  ['KeyState.attach, element', () => createKeyState().attach(el())],
];

describe('every watcher releases what it registered once disposed', () => {
  it.each(watchers)('%s', (_, watch) => {
    const before = probe.live();
    const dispose = watch();
    dispose();
    probe.flush();
    // Measured with the watched element still in the document, so what was left on it still counts.
    const after = probe.live();
    for (const node of made.splice(0)) node.remove();
    expect(grownSince(before, after)).toEqual([]);
  });
});
