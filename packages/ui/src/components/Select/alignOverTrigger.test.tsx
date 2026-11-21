import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useLayoutEffect, useRef } from 'react';
import { I18nProvider } from 'react-aria';
import { AlignOverTrigger, NO_NUDGE, type Nudge } from './alignOverTrigger';
import s from './Select.module.css';

type Box = { left: number; top: number; width: number; height: number };

// On the prototype, since the code under test reads some rects past an instance's own.
const rects = new Map<Element, Box>();
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const b = rects.get(this) ?? { left: 0, top: 0, width: 0, height: 0 };
    return new DOMRect(b.left, b.top, b.width, b.height);
  });
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(1000);
});
afterEach(() => {
  rects.clear();
  vi.restoreAllMocks();
});

function size(el: HTMLElement, width: number, height: number) {
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
}

/** A trigger at (100, 100) and its list resting under it, the list drawn at `scale`. */
function lay(root: HTMLElement, scale: number, listLeft = 100) {
  const q = (sel: string) => root.querySelector<HTMLElement>(sel)!;
  rects.set(q('[data-testid=trigger]'), { left: 100, top: 100, width: 50, height: 10 });
  rects.set(q(`.${s.value}`), { left: 105, top: 102, width: 40, height: 6 });
  rects.set(q('[data-testid=popover]'), { left: listLeft, top: 110, width: 60, height: 40 });
  rects.set(q(`.${s.optionLabel}`), { left: 104, top: 130, width: 40, height: 6 });
  size(q('[data-testid=popover]'), 60 / scale, 40 / scale);
}

function Harness({ selected, applied = NO_NUDGE, onMeasure, before, rtl }: { selected: boolean; applied?: Nudge; onMeasure: (n: Nudge) => void; before?: () => void; rtl?: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef(null);
  return (
    <>
      <button ref={triggerRef} data-testid="trigger" dir={rtl ? 'rtl' : undefined} style={rtl ? { direction: 'rtl' } : undefined}><span className={s.value}>Green</span></button>
      <div data-weasel-overlay="" data-testid="popover">
        <Before run={before} />
        <AlignOverTrigger triggerRef={triggerRef} pressRef={pressRef} applied={applied} onMeasure={onMeasure} />
        <div {...(selected ? { 'data-selected': '' } : {})}><span className={s.optionLabel}>Green</span></div>
      </div>
    </>
  );
}

/** Runs `run` in a layout effect ahead of AlignOverTrigger's, once the DOM exists. */
function Before({ run }: { run?: () => void }) {
  useLayoutEffect(() => run?.());
  return null;
}

describe('AlignOverTrigger', () => {
  it('states its nudge in the px of a list drawn at half size', () => {
    const onMeasure = vi.fn();
    render(<Harness selected onMeasure={onMeasure} before={() => lay(document.body, 0.5)} />);
    // In client px the row sits 28 below its place and 1 left of it; the list's own px are twice that.
    expect(onMeasure).toHaveBeenCalledWith({ offset: -56, crossOffset: 2 });
  });

  it("holds the list inside its overlay frame's part of the viewport", () => {
    const onMeasure = vi.fn();
    const frame = document.createElement('div');
    frame.dataset.weaselOverlayFrame = '';
    document.body.append(frame);
    rects.set(frame, { left: 0, top: 0, width: 400, height: 130 });
    render(<Harness selected onMeasure={onMeasure} before={() => lay(frame, 1)} />, { container: frame });
    // The row would sit 28 up, but the list's foot would then pass the frame's, less the 12px edge.
    expect(onMeasure).toHaveBeenCalledWith({ offset: -32, crossOffset: 1 });
    frame.remove();
  });

  it('lines the selected row up with the value of a right-to-left trigger', () => {
    const onMeasure = vi.fn();
    render(
      <I18nProvider locale="ar">
        <Harness selected rtl onMeasure={onMeasure} before={() => lay(document.body, 1, 90)} />
      </I18nProvider>,
    );
    // React Aria rests the list's right edge on the trigger's, at 150; the label's right edge, 54 into the list,
    // belongs under the value's at 145, so the list's left goes to 91, one right of where it rests.
    expect(onMeasure).toHaveBeenCalledWith({ offset: -28, crossOffset: 1 });
    expect(document.querySelector<HTMLElement>('[data-testid=popover]')!.dataset.align).toBe('start');
  });

  it('clears data-align when the list loses its selected row while open', () => {
    const onMeasure = vi.fn();
    const { getByTestId, rerender } = render(<Harness selected onMeasure={onMeasure} />);
    expect(getByTestId('popover').dataset.align).toBe('start');
    rerender(<Harness selected={false} onMeasure={onMeasure} />);
    expect(getByTestId('popover').dataset.align).toBeUndefined();
  });
});
