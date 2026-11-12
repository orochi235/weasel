import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FitLabel, FitScope, labelForms, useFitScope } from './FitLabel';

describe('labelForms', () => {
  it('puts the name ahead of its shorter forms', () => {
    expect(labelForms('Tracking', ['Track', 'VA'])).toEqual(['Tracking', 'Track', 'VA']);
  });

  it('is the name alone without shorter forms', () => {
    expect(labelForms('Size')).toEqual(['Size']);
  });

  it('drops a missing name rather than offering it as a form', () => {
    expect(labelForms(undefined, ['B'])).toEqual(['B']);
  });
});

describe('FitLabel', () => {
  it('shows its first form outside any scope', () => {
    const { container } = render(<FitLabel forms={['Tracking', 'VA']} />);
    expect(container.textContent).toBe('Tracking');
  });
});

describe('useFitScope', () => {
  afterEach(() => vi.restoreAllMocks());

  function Row() {
    const ref = useRef<HTMLDivElement>(null);
    const scope = useFitScope(ref);
    return (
      <div ref={ref}>
        <FitScope value={scope}><FitLabel forms={['Tracking', 'VA']} /></FitScope>
      </div>
    );
  }

  it('tries the full forms again once a web font loads, as text set in a fallback font may have stepped too far', () => {
    let overflowing = true;
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => (overflowing ? 120 : 80));
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => 100);
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    try {
      const { container } = render(<Row />);
      expect(container.textContent).toBe('VA');
      overflowing = false;
      act(() => { fonts.dispatchEvent(new Event('loadingdone')); });
      expect(container.textContent).toBe('Tracking');
    } finally {
      delete (document as { fonts?: unknown }).fonts;
    }
  });
});
