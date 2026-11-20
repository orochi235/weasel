import { render } from '@testing-library/react';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasStack } from '../canvas/CanvasStack';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { TrialOverview } from './TrialOverview';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('<TrialOverview> over a canvas stack', () => {
  it("repaints a timed layer on each of the stack's ticks", async () => {
    // Every 2D call a no-op; the stack paints on its frame loop, so a call made inside a tick is the overview's.
    const ctx = new Proxy({}, { get: (_t, key) => (key === 'canvas' ? undefined : () => {}) });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const moving: CanvasLayerDescriptor = {
      id: 'moving',
      visible: true,
      timed: true,
      render: vi.fn(),
    };
    const listeners = new Set<() => void>();
    const ticks = (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    };
    const { container } = render(
      <CanvasStack
        layers={[moving]}
        view={{ zoom: 1, pan: { x: 0, y: 0 } }}
        onViewChange={vi.fn()}
        ticks={ticks}
      >
        <TrialOverview width={200} height={150} />
      </CanvasStack>,
      { wrapper: withIcons },
    );
    const overview = container.querySelector('.lk-overview__canvas');
    expect(overview).not.toBeNull();
    expect(listeners.size).toBeGreaterThan(0);
    vi.mocked(moving.render).mockClear();
    for (const fn of [...listeners]) fn();
    expect(moving.render).toHaveBeenCalled();
  });
});
