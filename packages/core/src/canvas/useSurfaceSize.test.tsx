import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { useSurfaceSize, type SurfaceSizeProps } from './useSurfaceSize';

afterEach(() => { cleanup(); });

function Host(props: SurfaceSizeProps) {
  const element = useRef<HTMLDivElement>(null);
  useSurfaceSize(props, element);
  return <div ref={element} />;
}

describe('useSurfaceSize', () => {
  it('reports an explicit size of 0, and the size it is restored to', () => {
    const onResize = vi.fn();
    const { rerender } = render(<Host width={100} height={80} onResize={onResize} />);
    rerender(<Host width={0} height={80} onResize={onResize} />);
    rerender(<Host width={100} height={80} onResize={onResize} />);
    expect(onResize.mock.calls.map(([size]) => size)).toEqual([
      { width: 100, height: 80 }, { width: 0, height: 80 }, { width: 100, height: 80 },
    ]);
  });
});
