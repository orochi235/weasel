import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useBoxes, type Box } from './useBoxes';

// A box tipped by a transform: its laid-out size is 10 by 20, its bounding rect 18 by 18.
function tipped(el: HTMLElement | null) {
  if (!el) return;
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: 10 });
  Object.defineProperty(el, 'offsetHeight', { configurable: true, value: 20 });
  el.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 18, bottom: 18, width: 18, height: 18, toJSON: () => {} }) as DOMRect;
}

function measured(untransformed: boolean): readonly Box[] {
  let seen: readonly Box[] = [];
  function Probe() {
    const ref = useRef<HTMLDivElement | null>(null);
    seen = useBoxes(() => [ref.current], 1, { untransformed });
    return <div ref={(el) => { tipped(el); ref.current = el; }} />;
  }
  render(<Probe />);
  return seen;
}

describe('useBoxes', () => {
  it('reads the bounding rect by default', () => {
    expect(measured(false)).toEqual([{ width: 18, height: 18 }]);
  });

  it('reads the laid-out size, which a transform leaves alone, when asked for it untransformed', () => {
    expect(measured(true)).toEqual([{ width: 10, height: 20 }]);
  });
});
