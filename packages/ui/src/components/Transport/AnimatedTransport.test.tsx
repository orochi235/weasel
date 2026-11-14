import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '../../testing/withIcons';
import { AnimatedTransport } from './AnimatedTransport';
import { fakeHandle } from './timelineHandle.fixtures';

describe('AnimatedTransport', () => {
  it('plays, loops, and scrubs the handle it is given, and shows where it stands', () => {
    const h = fakeHandle();
    renderWithIcons(<AnimatedTransport handle={h} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(h.resume).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: 'Loop' }));
    expect(h.setLoop).toHaveBeenCalledWith(true);
    expect(screen.getByRole('switch', { name: 'Loop' }).getAttribute('aria-checked')).toBe('true');
    act(() => { h.seek(250); });
    expect(screen.getByTestId('timeline-time').textContent).toBe('0.25s / 1.00s');
  });

  it('leaves out the scrub bar given scrub={false}', () => {
    renderWithIcons(<AnimatedTransport handle={fakeHandle()} scrub={false} />);
    expect(screen.queryByRole('slider', { name: 'Position' })).toBeNull();
  });
});
