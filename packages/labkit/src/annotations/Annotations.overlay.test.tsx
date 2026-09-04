/**
 * What jsdom can honestly see of the overlay: which tiles get registered,
 * where the input boxes land, and that both come back out on unmount.
 *
 * **GL is not exercised here.** jsdom's canvas has no WebGL2, so `<Canvas>`'s
 * paint bails silently and nothing reaches the shared buffer — an assertion
 * about pixels in this file would be an assertion about the emulation. The
 * marks themselves are proved by `paint.test.ts` (pure) and by a screenshot.
 */
import { act, render } from '@testing-library/react';
import { StrictMode, useRef } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrialIdProvider } from '../state/context';
import { SurfaceCanvasContext, SurfaceContext } from '../surface/SurfaceContext';
import type { SurfaceHandle } from '../surface/useTiledSurface';
import { useTiledSurface } from '../surface/useTiledSurface';
import { AnnotationTargets } from './AnnotationTargets';
import { createAnnotationStore } from './store';
import type { AnnotationsCapability, AnnotationTarget } from './types';

function stubBox(el: HTMLElement, left: number, top: number, width: number, height: number): void {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
}

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

function Harness({ toolId = 'rect' }: { toolId?: string }) {
  const a = useRef<HTMLDivElement | null>(null);
  const b = useRef<HTMLDivElement | null>(null);
  const surface = useTiledSurface({ onFrame: () => {} });
  const annotations = useRef(createAnnotationStore({ targets: () => [] })).current;

  const capability: AnnotationsCapability = {
    targets: (): AnnotationTarget[] => [
      { id: 'pane:a', ref: a, content: { w: 200, h: 100 } },
      { id: 'pane:b', ref: b, content: { w: 200, h: 100 } },
    ],
  };

  return (
    <SurfaceContext.Provider value={surface}>
      <SurfaceCanvasContext.Provider value={null}>
        <div
          data-testid="stage"
          ref={(el) => {
            if (!el) return;
            // A non-zero container origin, so a rect composed against the
            // wrong one is visible rather than accidentally right.
            stubBox(el, 12, 7, 800, 600);
            surface.containerRef(el);
          }}
        >
          <div
            data-testid="a"
            ref={(el) => {
              a.current = el;
              if (el) stubBox(el, 40, 20, 200, 100);
            }}
          />
          <div
            data-testid="b"
            ref={(el) => {
              b.current = el;
              if (el) stubBox(el, 400, 300, 200, 100);
            }}
          />
          <AnnotationTargets
            capability={capability}
            state={{}}
            config={{}}
            annotations={annotations}
            activeToolId={toolId}
          />
        </div>
      </SurfaceCanvasContext.Provider>
    </SurfaceContext.Provider>
  );
}

describe('<AnnotationTargets>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('puts an input box over each target, at the rect the surface measured', () => {
    const { container } = render(<Harness />, { wrapper: StrictMode });
    act(() => {
      vi.advanceTimersByTime(64);
    });

    const boxes = [...container.querySelectorAll<HTMLElement>('.lk-annotate__input')];
    expect(boxes.map((el) => el.dataset.annotationTarget)).toEqual(['pane:a', 'pane:b']);
    // The rect, not merely its existence: a box positioned against the wrong
    // origin takes input for the wrong part of the picture.
    expect(boxes[0]?.style.getPropertyValue('--lk-anno-x')).toBe('28px');
    expect(boxes[0]?.style.getPropertyValue('--lk-anno-y')).toBe('13px');
    expect(boxes[1]?.style.getPropertyValue('--lk-anno-x')).toBe('388px');
    expect(boxes[1]?.style.getPropertyValue('--lk-anno-h')).toBe('100px');
  });

  it('lands the boxes in the surface container, not among the instrument DOM', () => {
    const { container } = render(<Harness />, { wrapper: StrictMode });
    act(() => {
      vi.advanceTimersByTime(64);
    });
    const stage = container.querySelector('[data-testid="stage"]');
    for (const el of container.querySelectorAll('.lk-annotate__input')) {
      expect(el.parentElement).toBe(stage);
    }
  });

  it('takes its tiles back out on unmount', () => {
    const { container, unmount } = render(<Harness />, { wrapper: StrictMode });
    act(() => {
      vi.advanceTimersByTime(64);
    });
    expect(container.querySelectorAll('.lk-annotate__input')).toHaveLength(2);
    unmount();
    expect(document.querySelectorAll('.lk-annotate__input')).toHaveLength(0);
  });
});

/** One trial's worth of the harness above: its own pane element, its own
 *  overlay, and the target id every trial of an instrument shares. */
function OneTrial({
  trialId,
  box,
}: {
  trialId: string;
  box: { left: number; top: number; width: number; height: number };
}) {
  const pane = useRef<HTMLDivElement | null>(null);
  const annotations = useRef(createAnnotationStore({ targets: () => [] })).current;
  const capability: AnnotationsCapability = {
    targets: (): AnnotationTarget[] => [{ id: 'pane:a', ref: pane, content: { w: 200, h: 100 } }],
  };
  return (
    <TrialIdProvider trialId={trialId}>
      <div
        data-testid={trialId}
        ref={(el) => {
          pane.current = el;
          if (el) stubBox(el, box.left, box.top, box.width, box.height);
        }}
      />
      <AnnotationTargets
        capability={capability}
        state={{}}
        config={{}}
        annotations={annotations}
        activeToolId="rect"
      />
    </TrialIdProvider>
  );
}

describe('two trials of one instrument', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(0), 16),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // An instrument names its regions once, so every trial of it declares the
  // same target id. Sharing the surface's tile namespace, the trial that opens
  // second takes the first one's rect, its observer registration and its
  // painter — and the first is never told it moved again, so it keeps the box
  // it was measured at while it was the only trial open.
  it('re-measures a trial that was alone when a second one opens beside it', () => {
    let handle: SurfaceHandle | null = null;

    function Trials({ second }: { second: boolean }) {
      const surface = useTiledSurface({ onFrame: () => {} });
      handle = surface;
      return (
        <SurfaceContext.Provider value={surface}>
          <SurfaceCanvasContext.Provider value={null}>
            <div
              ref={(el) => {
                if (!el) return;
                stubBox(el, 0, 0, 1200, 700);
                surface.containerRef(el);
              }}
            >
              <OneTrial
                trialId="t1"
                box={{ left: 0, top: 0, width: second ? 476 : 666, height: 639 }}
              />
              {second ? (
                <OneTrial trialId="t2" box={{ left: 500, top: 0, width: 476, height: 639 }} />
              ) : null}
            </div>
          </SurfaceCanvasContext.Provider>
        </SurfaceContext.Provider>
      );
    }

    const boxes = (root: HTMLElement) => [
      ...root.querySelectorAll<HTMLElement>('.lk-annotate__input'),
    ];
    const widths = (root: HTMLElement) =>
      boxes(root).map((el) => el.style.getPropertyValue('--lk-anno-w'));

    const { container, rerender } = render(<Trials second={false} />, { wrapper: StrictMode });
    act(() => {
      vi.advanceTimersByTime(64);
    });
    expect(widths(container)).toEqual(['666px']);

    // The grid halves the open trial to make room. jsdom's ResizeObserver never
    // fires, so this takes `Workspace`'s path — the one it takes anyway for a
    // tile that moves without resizing, which no observer would have seen.
    rerender(<Trials second={true} />);
    act(() => {
      handle?.invalidateRects();
      vi.advanceTimersByTime(64);
    });

    expect(widths(container)).toEqual(['476px', '476px']);
    expect(boxes(container).map((el) => el.style.getPropertyValue('--lk-anno-x'))).toEqual([
      '0px',
      '500px',
    ]);
  });
});
