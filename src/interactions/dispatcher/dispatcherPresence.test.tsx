import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DispatcherPresenceProvider, useIsDispatcherMounted } from './dispatcherPresence';

function Probe({ onValue }: { onValue: (v: boolean) => void }) {
  const v = useIsDispatcherMounted();
  onValue(v);
  return null;
}

describe('DispatcherPresence', () => {
  it('returns false outside provider', () => {
    let captured = true;
    render(<Probe onValue={(v) => { captured = v; }} />);
    expect(captured).toBe(false);
  });

  it('returns true inside provider', () => {
    let captured = false;
    render(
      <DispatcherPresenceProvider>
        <Probe onValue={(v) => { captured = v; }} />
      </DispatcherPresenceProvider>,
    );
    expect(captured).toBe(true);
  });
});
