import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useCanvasSurface, type CanvasSurface, type CanvasSurfaceOptions } from './useCanvasSurface';

afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Host({ paint, options, onSurface }: {
  paint: () => boolean;
  options: CanvasSurfaceOptions;
  onSurface: (surface: CanvasSurface) => void;
}) {
  const surface = useCanvasSurface(paint, options);
  onSurface(surface);
  return null;
}

describe('useCanvasSurface', () => {
  it('retries on a frame when the paint a resize makes in place does not land', async () => {
    let lands = true;
    const paint = vi.fn(() => lands);
    const { rerender } = render(
      <Host paint={paint} options={{ onCommit: 'paint', size: { width: 100, height: 80 } }} onSurface={() => {}} />,
    );
    await act(async () => { await frame(); await frame(); });
    paint.mockClear();

    lands = false;
    rerender(<Host paint={paint} options={{ onCommit: 'paint', size: { width: 140, height: 80 } }} onSurface={() => {}} />);
    expect(paint).toHaveBeenCalledTimes(1);
    lands = true;
    await act(async () => { await frame(); await frame(); });
    expect(paint).toHaveBeenCalledTimes(2);
  });
});
