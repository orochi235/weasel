import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { useViewDepSource } from './view';
import type { View } from 'core/viewport/view';

describe('useViewDepSource', () => {
  it('returns a stable-identity ViewApi that reads/writes through the supplied ref + callback', () => {
    let capturedView: any = null;
    const onChange = vi.fn();
    const v1: View = { x: 0, y: 0, scale: 1 } as unknown as View;
    function Wire() {
      const viewRef = useRef<View>(v1);
      const api = useViewDepSource(viewRef, onChange);
      capturedView = api;
      return null;
    }
    render(<Wire />);
    expect(capturedView).toBeDefined();
    expect(capturedView.get()).toBe(v1);
    const v2: View = { x: 5, y: 5, scale: 2 } as unknown as View;
    capturedView.set(v2);
    expect(onChange).toHaveBeenCalledWith(v2);
  });
});
