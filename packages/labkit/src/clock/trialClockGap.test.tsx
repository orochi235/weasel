import { render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { TrialClockContext } from './contexts';
import { useTrialClock } from './hooks';
import { createTrialClock } from './trialClock';

describe('useTrialClock', () => {
  it('re-renders for a change made after it rendered and before it subscribed', () => {
    const handle = createTrialClock({ duration: 1000 });
    function Rate() {
      return <span>rate {useTrialClock()?.rate}</span>;
    }
    function Play() {
      useLayoutEffect(() => {
        handle.clock.rate = 1;
      }, []);
      return null;
    }
    render(
      <TrialClockContext.Provider value={handle}>
        <Rate />
        <Play />
      </TrialClockContext.Provider>,
    );
    expect(screen.getByText('rate 1')).toBeTruthy();
  });
});
