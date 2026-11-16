import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('keeps the surviving region\'s toast.ttlMs when another region on the queue unmounts', () => {
    const q = createToastQueue();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithIcons(
      <KitSettingsProvider value={{ toast: { ttlMs: 3000 } }}>
        <ToastRegion queue={q} />
      </KitSettingsProvider>,
    );
    const second = renderWithIcons(<ToastRegion queue={q} />);
    second.unmount();
    act(() => q.add('info', 'Saved'));
    expect(timeoutOf(q)).toBe(3000);
    warn.mockRestore();
  });

  it('warns once when a second region mounts on one queue', () => {
    const q = createToastQueue();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithIcons(<ToastRegion queue={q} />);
    expect(warn).not.toHaveBeenCalled();
    renderWithIcons(<><ToastRegion queue={q} /><ToastRegion queue={q} /></>);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('second <ToastRegion>');
    warn.mockRestore();
  });

  it('warns once and times by the constant when toast.ttlMs is not above 0', () => {
    const q = createToastQueue();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderWithIcons(
      <KitSettingsProvider value={{ toast: { ttlMs: -5 } }}>
        <ToastRegion queue={q} />
      </KitSettingsProvider>,
    );
    act(() => q.add('info', 'One'));
    act(() => q.add('info', 'Two'));
    expect(timeoutOf(q)).toBe(DEFAULT_TTL_MS);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('toast.ttlMs kit setting is -5');
    warn.mockRestore();
  });
});
