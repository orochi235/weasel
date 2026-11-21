import { describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { BASES } from './bases';
import { useInsets } from './useInsets';
import type { ShapeInsets } from './types';

const base = BASES.quatrefoil;

function Probe({ pad, out }: { pad: number; out: (insets: ShapeInsets) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  out(useInsets(base, base.defaults, ref));
  return <div style={{ padding: `${pad}px` }}><span ref={ref}>label</span></div>;
}

function settled(pad: number, from?: number): ShapeInsets {
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { width: 120, height: 16, top: 0, left: 0, right: 120, bottom: 16, x: 0, y: 0, toJSON: () => ({}) } as DOMRect,
  );
  let last: ShapeInsets | undefined;
  const out = (insets: ShapeInsets) => { last = insets; };
  const { rerender, unmount } = render(<Probe pad={from ?? pad} out={out} />);
  if (from !== undefined) rerender(<Probe pad={pad} out={out} />);
  unmount();
  spy.mockRestore();
  return last!;
}

describe('useInsets on a base that fits its content', () => {
  it('fits again when only the badge padding changes', () => {
    expect(settled(12, 0)).toEqual(settled(12));
  });
});
