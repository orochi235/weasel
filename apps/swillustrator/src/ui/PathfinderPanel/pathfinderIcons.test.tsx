import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
} from './pathfinderIcons';

describe('pathfinderIcons', () => {
  it('UnionIcon renders an svg with two circles', () => {
    const { container } = render(<UnionIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
  });

  it('IntersectIcon renders an svg with a path for the lens', () => {
    const { container } = render(<IntersectIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('SubtractIcon renders an svg with a crescent path', () => {
    const { container } = render(<SubtractIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('ExcludeIcon renders an svg with a path for both crescents', () => {
    const { container } = render(<ExcludeIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('DivideIcon renders an svg with two circles and a divider line', () => {
    const { container } = render(<DivideIcon />);
    expect(container.querySelector('svg line')).toBeTruthy();
    expect(container.querySelectorAll('svg circle').length).toBeGreaterThanOrEqual(2);
  });

  it('icons are aria-hidden (button supplies the accessible name)', () => {
    const { container } = render(<UnionIcon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
