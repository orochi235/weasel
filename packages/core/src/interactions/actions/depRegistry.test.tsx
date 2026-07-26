import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  DepRegistryProvider,
  useDepSource,
  useDepRegistry,
  type DepRegistry,
} from './depRegistry';

function CaptureRegistry({ onRegistry }: { onRegistry: (r: DepRegistry) => void }) {
  const r = useDepRegistry();
  onRegistry(r);
  return null;
}

describe('DepRegistry', () => {
  it('initially returns undefined for any name', () => {
    let reg!: DepRegistry;
    render(
      <DepRegistryProvider>
        <CaptureRegistry onRegistry={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect((reg.get as any)('selection')).toBeUndefined();
  });

  it('useDepSource registers a live source; get returns latest value', () => {
    let reg!: DepRegistry;
    let value = 1;
    function Source() {
      (useDepSource as any)('selection', () => value);
      return null;
    }
    render(
      <DepRegistryProvider>
        <Source />
        <CaptureRegistry onRegistry={(r) => { reg = r; }} />
      </DepRegistryProvider>,
    );
    expect((reg.get as any)('selection')).toBe(1);
    act(() => { value = 42; });
    expect((reg.get as any)('selection')).toBe(42);
  });

  it('unmounting a source removes it from the registry', () => {
    let reg!: DepRegistry;
    function Source() {
      (useDepSource as any)('selection', () => 'live');
      return null;
    }
    function Holder({ withSource }: { withSource: boolean }) {
      return <>{withSource && <Source />}<CaptureRegistry onRegistry={(r) => { reg = r; }} /></>;
    }
    const { rerender } = render(
      <DepRegistryProvider><Holder withSource={true} /></DepRegistryProvider>,
    );
    expect((reg.get as any)('selection')).toBe('live');
    rerender(<DepRegistryProvider><Holder withSource={false} /></DepRegistryProvider>);
    expect((reg.get as any)('selection')).toBeUndefined();
  });

  it('useDepRegistry outside provider throws a clear error', () => {
    expect(() => render(<CaptureRegistry onRegistry={() => {}} />)).toThrow(/DepRegistryProvider/);
  });
});
