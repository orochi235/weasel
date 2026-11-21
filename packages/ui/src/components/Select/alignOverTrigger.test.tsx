import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { AlignOverTrigger, NO_NUDGE, type Nudge } from './alignOverTrigger';
import s from './Select.module.css';

type Box = { left: number; top: number; width: number; height: number };

function place(el: Element, b: Box) {
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(b.left, b.top, b.width, b.height),
  });
}

function Harness({ selected, applied = NO_NUDGE, onMeasure }: { selected: boolean; applied?: Nudge; onMeasure: (n: Nudge) => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef(null);
  return (
    <>
      <button ref={triggerRef} data-testid="trigger"><span className={s.value}>Green</span></button>
      <div data-weasel-overlay="" data-testid="popover">
        <AlignOverTrigger triggerRef={triggerRef} pressRef={pressRef} applied={applied} onMeasure={onMeasure} />
        <div {...(selected ? { 'data-selected': '' } : {})}><span className={s.optionLabel}>Green</span></div>
      </div>
    </>
  );
}

describe('AlignOverTrigger', () => {
  it('clears data-align when the list loses its selected row while open', () => {
    const onMeasure = vi.fn();
    const { getByTestId, rerender } = render(<Harness selected onMeasure={onMeasure} />);
    expect(getByTestId('popover').dataset.align).toBe('start');
    rerender(<Harness selected={false} onMeasure={onMeasure} />);
    expect(getByTestId('popover').dataset.align).toBeUndefined();
  });
});
