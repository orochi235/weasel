import { render } from '@testing-library/react';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FitScope, useFitScale, useFitScope } from './FitLabel';
import { sharedScale, type ScaleFit } from './fitScale';

describe('sharedScale', () => {
  it('is the smallest scale any shared fit needs', () => {
    expect(sharedScale([{ scale: 1, shared: true }, { scale: 0.85, shared: true }, { scale: 0.92, shared: true }], 0.6)).toBe(0.85);
  });

  it('floors at the minimum and never passes full size', () => {
    expect(sharedScale([{ scale: 1, shared: true }, { scale: 0.4, shared: true }], 0.6)).toBe(0.6);
    expect(sharedScale([{ scale: 1.6, shared: true }], 0.6)).toBe(1);
  });

  it('leaves out a fit that sizes itself, and is null with none shared', () => {
    expect(sharedScale([{ scale: 0.9, shared: true }, { scale: 0.7, shared: false }], 0.6)).toBe(0.9);
    expect(sharedScale([{ scale: 0.7, shared: false }, null], 0.6)).toBeNull();
  });

  it('resolves a million fits without overflowing the call stack', () => {
    const fits = Array.from({ length: 1_000_000 }, (_, i) => ({ scale: i === 9 ? 0.5 : 0.9, shared: true }));
    expect(sharedScale(fits, 0.1)).toBe(0.5);
  });
});

function Member({ fit, heard }: { fit: ScaleFit; heard: (fit: ScaleFit) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const scale = useFitScale();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!scale || !el) return;
    scale.join(String(fit.scale), { el, measure: () => fit, onFit: heard });
    return () => scale.leave(String(fit.scale));
  }, [scale, fit, heard]);
  return <span ref={ref} />;
}

function Scope({ min, children }: { min: number; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const fit = useFitScope(ref, { scale: { min, property: '--test-scale' } });
  return <div ref={ref} data-testid="scope"><FitScope value={fit}>{children}</FitScope></div>;
}

function Plain({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref}><FitScope value={useFitScope(ref)}>{children}</FitScope></div>;
}

const scaleOf = (el: HTMLElement) => el.style.getPropertyValue('--test-scale');

describe('useFitScope with a scale stage', () => {
  it('publishes the smallest shared scale on its element before paint, and tells each member its fit', () => {
    const heard = vi.fn();
    const { getByTestId } = render(
      <Scope min={0.6}>
        <Member fit={{ scale: 0.9, shared: true }} heard={heard} />
        <Member fit={{ scale: 0.75, shared: true }} heard={heard} />
        <Member fit={{ scale: 0.5, shared: false }} heard={heard} />
      </Scope>,
    );
    expect(scaleOf(getByTestId('scope'))).toBe('0.75');
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('re-resolves when a member leaves, and drops the property once none is shared', () => {
    const heard = vi.fn();
    const tree = (members: ScaleFit[]) => (
      <Scope min={0.6}>{members.map((f) => <Member key={f.scale} fit={f} heard={heard} />)}</Scope>
    );
    const { getByTestId, rerender } = render(tree([{ scale: 0.9, shared: true }, { scale: 0.7, shared: true }]));
    expect(scaleOf(getByTestId('scope'))).toBe('0.7');
    rerender(tree([{ scale: 0.9, shared: true }]));
    expect(scaleOf(getByTestId('scope'))).toBe('0.9');
    rerender(tree([]));
    expect(scaleOf(getByTestId('scope'))).toBe('');
  });

  it('tells its members their fits again when the floor moves', () => {
    const heard = vi.fn();
    const fit = { scale: 0.5, shared: true };
    const { getByTestId, rerender } = render(<Scope min={0.6}><Member fit={fit} heard={heard} /></Scope>);
    expect(scaleOf(getByTestId('scope'))).toBe('0.6');
    heard.mockClear();
    rerender(<Scope min={0.4}><Member fit={fit} heard={heard} /></Scope>);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(scaleOf(getByTestId('scope'))).toBe('0.5');
  });

  it('is passed on by a nested scope that runs none, and absent outside one', () => {
    const seen: (boolean | null)[] = [];
    function Probe() {
      const scale = useFitScale();
      const [once] = useState(() => scale !== null);
      seen.push(once);
      return null;
    }
    render(<><Probe /><Plain><Probe /></Plain><Scope min={0.6}><Plain><Probe /></Plain></Scope></>);
    expect(seen.slice(0, 3)).toEqual([false, false, true]);
  });
});
