import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { AnimatedTransport } from './AnimatedTransport';
import { fakeHandle } from './timelineHandle.fixtures';

describe('useTimelinePlayback', () => {
  it('reads a timeline played backward to 0 as stopped', () => {
    const h = fakeHandle();
    h.setTimeScale(-1);
    h.resume();
    renderWithIcons(<AnimatedTransport handle={h} />);
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('reads a timeline at its end on its last pass as stopped', () => {
    for (const loop of [0, 1]) {
      const h = fakeHandle({ time: () => 1000, loop: () => loop });
      h.resume();
      const { unmount } = renderWithIcons(<AnimatedTransport handle={h} />);
      expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
      unmount();
    }
  });

  it('reads a canceled timeline as stopped', () => {
    const h = fakeHandle();
    h.resume();
    renderWithIcons(<AnimatedTransport handle={h} />);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    act(() => { h.cancel(); });
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
  });

  it('rewinds a timeline played backward to 0 to its end on play', () => {
    const h = fakeHandle();
    h.setTimeScale(-1);
    renderWithIcons(<AnimatedTransport handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(h.seek).toHaveBeenLastCalledWith(1000);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
  });

  it('shows a duration an edit changes', () => {
    let duration = 1000;
    const h = fakeHandle({ duration: () => duration });
    renderWithIcons(<AnimatedTransport handle={h} />);
    act(() => { h.edit(() => { duration = 2000; }); });
    expect(screen.getByTestId('timeline-time').textContent).toBe('0.00s / 2.00s');
  });

  it('shows a negative time scale as reversed, at its speed', () => {
    const h = fakeHandle();
    h.setTimeScale(-2);
    renderWithIcons(<AnimatedTransport handle={h} />);
    expect(screen.getByRole('switch', { name: 'Reverse' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('slider', { name: 'Rate' }).getAttribute('aria-valuetext')).not.toMatch(/-/);
    fireEvent.click(screen.getByRole('switch', { name: 'Reverse' }));
    expect(h.setTimeScale).toHaveBeenLastCalledWith(2);
  });
});
