import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnnotationTargets } from './AnnotationTargets';
import { createAnnotationStore } from './store';
import type { AnnotationsCapability } from './types';

type Fire = (target: Element, width: number, height: number) => void;

/** An observer that reports only when the test says the element resized. */
function stubObserver(): { fire: Fire; observed: Set<Element> } {
  const observed = new Set<Element>();
  let callback: ResizeObserverCallback = () => {};
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe(el: Element) {
        observed.add(el);
      }
      unobserve(el: Element) {
        observed.delete(el);
      }
      disconnect() {
        observed.clear();
      }
    },
  );
  const fire: Fire = (target, width, height) =>
    callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
  return { fire, observed };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AnnotationTargets', () => {
  it("asks for its targets again when a target's element resizes, and not when it reports the same size", () => {
    const { fire, observed } = stubObserver();
    const asked = vi.fn();
    const store = createAnnotationStore({ targets: () => [] });
    function Host() {
      const ref = useRef<HTMLDivElement | null>(null);
      const capability: AnnotationsCapability = {
        targets: () => {
          asked();
          return [{ id: 'box', ref, content: { w: 10, h: 10 } }];
        },
      };
      return (
        <>
          <div ref={ref} data-testid="box" />
          <AnnotationTargets
            capability={capability}
            state={null}
            config={null}
            trial={{ id: 't', view: null }}
            annotations={store}
            activeToolId={null}
          />
        </>
      );
    }
    const { getByTestId } = render(<Host />);
    const box = getByTestId('box');
    expect(observed.has(box)).toBe(true);
    const before = asked.mock.calls.length;

    act(() => fire(box, 300, 200));
    expect(asked.mock.calls.length).toBe(before + 1);
    act(() => fire(box, 300, 200));
    expect(asked.mock.calls.length).toBe(before + 1);
    act(() => fire(box, 320, 200));
    expect(asked.mock.calls.length).toBe(before + 2);
  });

  it('asks for its targets again when anything inside a target scrolls, and stops once it is gone', () => {
    stubObserver();
    const asked = vi.fn();
    const store = createAnnotationStore({ targets: () => [] });
    function Host() {
      const ref = useRef<HTMLDivElement | null>(null);
      const capability: AnnotationsCapability = {
        targets: () => {
          asked();
          return [{ id: 'box', ref, content: { w: 10, h: 10 } }];
        },
      };
      return (
        <>
          <div ref={ref} data-testid="box">
            <div data-testid="scroller" />
          </div>
          <AnnotationTargets
            capability={capability}
            state={null}
            config={null}
            trial={{ id: 't', view: null }}
            annotations={store}
            activeToolId={null}
          />
        </>
      );
    }
    const { getByTestId, unmount } = render(<Host />);
    const scroller = getByTestId('scroller');
    const before = asked.mock.calls.length;
    // `scroll` does not bubble, as in a browser.
    act(() => {
      scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
    });
    expect(asked.mock.calls.length).toBe(before + 1);
    unmount();
    scroller.dispatchEvent(new Event('scroll', { bubbles: false }));
    expect(asked.mock.calls.length).toBe(before + 1);
  });
});
