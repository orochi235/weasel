import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
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
});
