import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { FrameSetup } from '../frame/FrameController';
import { useHostConditions } from './hostConditions';

afterEach(() => {
  for (const el of Array.from(document.head.querySelectorAll('[data-fg-globals], [data-fg-overrides]'))) el.remove();
});

const styled = (css: string): FrameSetup => ({ applyGlobals: (_globals, target) => target.style(css) });
const globalsCss = () => Array.from(document.head.querySelectorAll('[data-fg-globals]'), (el) => el.textContent);

describe('useHostConditions', () => {
  it('applies a replaced setup’s globals and override scope, keeping the persisted overrides', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const overrides = { '--accent': 'red' };
    const globals = { mode: 'dark' };
    const { rerender } = renderHook((setup: FrameSetup) => useHostConditions(host, { hostId: 'h', globals, overrides, setup }), {
      initialProps: styled('a {}'),
    });
    expect(globalsCss()).toEqual(['a {}']);

    rerender({ ...styled('b {}'), cssVarsScope: '.inner' });
    expect(globalsCss()).toEqual(['b {}']);
    const rule = document.head.querySelector('[data-fg-overrides]')?.textContent ?? '';
    expect(rule).toContain('.inner');
    expect(rule).toContain('--accent');
    host.remove();
  });
});
