import '@weasel-js/theme/tokens.css';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { useState } from 'react';
import { OverlayPortalProvider } from '../../overlays/portalHost';
import { ToastRegion, type ToastRegionProps } from './Toast';
import { createToastQueue } from './queue';

afterEach(cleanup);

const hostStyle = document.createElement('style');
hostStyle.textContent =
  '.toast-host { position: absolute; left: 400px; top: 300px; width: 480px; height: 260px; }';
document.head.append(hostStyle);

type Via = 'provider' | 'prop';

function Hosted({ via, ...props }: ToastRegionProps & { via: Via }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  return (
    <div className="toast-host" data-testid="host" ref={setHost}>
      {host &&
        (via === 'provider' ? (
          <OverlayPortalProvider container={host}>
            <ToastRegion {...props} />
          </OverlayPortalProvider>
        ) : (
          <ToastRegion {...props} portalContainer={host} />
        ))}
    </div>
  );
}

function within(inner: DOMRect, outer: DOMRect): boolean {
  return (
    inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom
  );
}

for (const via of ['provider', 'prop'] as const) {
  test(`a toast given a container by ${via} sits inside that container's box`, async () => {
    const queue = createToastQueue();
    render(<Hosted via={via} queue={queue} />);
    act(() => queue.add('info', 'Contained', { ttlMs: null }));

    const host = screen.getByTestId('host').getBoundingClientRect();
    const toast = (await screen.findByRole('alertdialog')).getBoundingClientRect();
    expect(toast.width).toBeGreaterThan(0);
    expect(within(toast, host)).toBe(true);
    // bottom-right: hugs the container's corner, not the viewport's.
    expect(host.right - toast.right).toBeCloseTo(16, 0);
    expect(host.bottom - toast.bottom).toBeCloseTo(16, 0);
    expect(screen.getByRole('region', { name: /notifications/i }).parentElement).toBe(screen.getByTestId('host'));
  });
}

test('each placement anchors to its corner of the container', async () => {
  const queue = createToastQueue();
  render(<Hosted via="prop" queue={queue} placement="top-left" />);
  act(() => queue.add('info', 'Top left', { ttlMs: null }));
  const host = screen.getByTestId('host').getBoundingClientRect();
  const toast = (await screen.findByRole('alertdialog')).getBoundingClientRect();
  expect(toast.left - host.left).toBeCloseTo(16, 0);
  expect(toast.top - host.top).toBeCloseTo(16, 0);
});

test('with no container, the region is fixed to the viewport corner as before', async () => {
  const queue = createToastQueue();
  render(
    <div className="toast-host" data-wzl-theme="default">
      <ToastRegion queue={queue} />
    </div>,
  );
  act(() => queue.add('info', 'Page level', { ttlMs: null }));
  const region = await screen.findByRole('region', { name: /notifications/i });
  expect(region.parentElement).toBe(document.body);
  expect(getComputedStyle(region).position).toBe('fixed');
  const toast = (await screen.findByRole('alertdialog')).getBoundingClientRect();
  expect(window.innerWidth - toast.right).toBeCloseTo(16, 0);
  expect(window.innerHeight - toast.bottom).toBeCloseTo(16, 0);
});
