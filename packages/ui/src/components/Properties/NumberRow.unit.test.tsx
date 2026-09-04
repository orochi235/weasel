import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberRow } from './PropertyPanel';

describe('NumberRow unit', () => {
  it('renders no suffix by default', () => {
    const { container } = render(<NumberRow label="Width" value={20} onChange={() => {}} />);
    expect(container.textContent).not.toContain('px');
  });

  it('renders a string unit after the input', () => {
    const { container } = render(
      <NumberRow label="Width" value={20} unit="px" onChange={() => {}} />,
    );
    const input = container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();
    expect(container.textContent).toContain('px');
    // After the input, not before — the suffix reads as a trailing unit.
    expect(input?.nextElementSibling?.textContent).toBe('px');
  });

  it('renders a node unit as given', () => {
    const { container } = render(
      <NumberRow label="Angle" value={90} unit={<sup>°</sup>} onChange={() => {}} />,
    );
    expect(container.querySelector('sup')?.textContent).toBe('°');
  });
});
