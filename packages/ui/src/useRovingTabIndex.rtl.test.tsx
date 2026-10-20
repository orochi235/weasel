import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  rovingGridTarget,
  rovingTarget,
  useRovingTabIndex,
  type UseRovingTabIndexOptions,
} from './useRovingTabIndex';

const all3 = [true, true, true];

describe('rovingTarget — right-to-left', () => {
  it('swaps Left and Right', () => {
    expect(rovingTarget(1, 'ArrowLeft', all3, 'horizontal', 'rtl')).toBe(2);
    expect(rovingTarget(1, 'ArrowRight', all3, 'horizontal', 'rtl')).toBe(0);
    expect(rovingTarget(1, 'ArrowLeft', all3, 'both', 'rtl')).toBe(2);
  });

  it('leaves Up, Down, Home and End as they are', () => {
    expect(rovingTarget(1, 'ArrowDown', all3, 'both', 'rtl')).toBe(2);
    expect(rovingTarget(1, 'ArrowUp', all3, 'both', 'rtl')).toBe(0);
    expect(rovingTarget(1, 'Home', all3, 'both', 'rtl')).toBe(0);
    expect(rovingTarget(1, 'End', all3, 'both', 'rtl')).toBe(2);
  });

  it('leaves a vertical set ignoring Left and Right', () => {
    expect(rovingTarget(1, 'ArrowLeft', all3, 'vertical', 'rtl')).toBeNull();
  });
});

describe('rovingGridTarget — right-to-left', () => {
  const rows = [[0, 1, 2], [3, 4, 5]];
  const all = Array(6).fill(true) as boolean[];

  it('swaps Left and Right and keeps Up and Down', () => {
    expect(rovingGridTarget(2, 'ArrowLeft', all, rows, 'rtl')).toBe(3);
    expect(rovingGridTarget(3, 'ArrowRight', all, rows, 'rtl')).toBe(2);
    expect(rovingGridTarget(1, 'ArrowDown', all, rows, 'rtl')).toBe(4);
  });
});

function Bar({ wrapDir, ...options }: UseRovingTabIndexOptions & { wrapDir?: 'ltr' | 'rtl' }) {
  const roving = useRovingTabIndex(options);
  return (
    <div dir={wrapDir}>
      <div ref={roving.rootRef} onKeyDown={roving.onKeyDown} role="toolbar">
        {['a', 'b', 'c'].map((label) => <button key={label} type="button">{label}</button>)}
      </div>
    </div>
  );
}

const byName = (name: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent === name)!;

describe('useRovingTabIndex — right-to-left', () => {
  it('reads the direction from a dir attribute above the container', () => {
    render(<Bar orientation="horizontal" wrapDir="rtl" />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(byName('c'));
  });

  it('steps Left backward without one', () => {
    render(<Bar orientation="horizontal" />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(byName('a'));
  });

  it('lets an explicit dir override the layout', () => {
    render(<Bar orientation="horizontal" wrapDir="rtl" dir="ltr" />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(byName('a'));
  });

  it('mirrors a grid too', () => {
    render(<Bar columns={3} dir="rtl" />);
    fireEvent.keyDown(byName('b'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(byName('a'));
  });
});
