import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './Canvas';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function countDprReads(run: () => void): number {
  let reads = 0;
  const original = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    get() { reads++; return 1; },
  });
  try { run(); } finally {
    if (original) Object.defineProperty(window, 'devicePixelRatio', original);
    else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
  }
  return reads;
}

describe('Canvas dpr prop', () => {
  it('with dpr supplied, the paint path performs no ambient devicePixelRatio reads', () => {
    const reads = countDprReads(() => {
      render(<Canvas width={200} height={200} layers={{}} dpr={2} />);
    });
    expect(reads).toBe(0);
  });

  it('without dpr, the ambient fallback still reads window.devicePixelRatio (unchanged screen behavior)', () => {
    const reads = countDprReads(() => {
      render(<Canvas width={200} height={200} layers={{}} />);
    });
    expect(reads).toBeGreaterThan(0);
  });
});
