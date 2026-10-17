import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { KitSettingsProvider } from '@weasel-js/react';
import { createToastQueue, DEFAULT_TTL_MS, racQueueOf } from './queue';
import { ToastRegion } from './Toast';

afterEach(cleanup);

const timeoutOf = (q: ReturnType<typeof createToastQueue>) => racQueueOf(q).visibleToasts[0]?.timeout;

describe('ToastRegion kit settings', () => {
  it('times a toast by the constant with no provider', () => {
    const q = createToastQueue();
    renderWithIcons(<ToastRegion queue={q} />);
    act(() => q.add('info', 'Saved'));
    expect(timeoutOf(q)).toBe(DEFAULT_TTL_MS);
  });

  it("times a toast by the provider's toast.ttlMs, and a toast's own ttlMs over it", () => {
    const q = createToastQueue();
    renderWithIcons(
      <KitSettingsProvider value={{ toast: { ttlMs: 3000 } }}>
        <ToastRegion queue={q} />
      </KitSettingsProvider>,
    );
    act(() => q.add('info', 'Saved'));
    expect(timeoutOf(q)).toBe(3000);
    act(() => q.add('info', 'Own', { ttlMs: 1000 }));
    expect(timeoutOf(q)).toBe(1000);
  });

  it('goes back to the constant once the region unmounts', () => {
    const q = createToastQueue();
    const { unmount } = renderWithIcons(
      <KitSettingsProvider value={{ toast: { ttlMs: 3000 } }}>
        <ToastRegion queue={q} />
      </KitSettingsProvider>,
    );
    unmount();
    q.add('info', 'Later');
    expect(timeoutOf(q)).toBe(DEFAULT_TTL_MS);
  });
});
