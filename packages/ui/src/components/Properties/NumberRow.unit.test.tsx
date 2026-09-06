import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

describe('NumberRow spin buttons', () => {
  // Chrome reserves the spin-button gutter at the right edge whether or not it
  // paints the arrows, which is what pushed a right-aligned value clear of its
  // own border and left a gap a unit looked like it should fill. jsdom computes
  // no appearance and renders no pseudo-element, so there is nothing here to
  // assert against — the stylesheet is the only place the removal is visible.
  const sheet = readFileSync(
    resolve(process.cwd(), 'packages/ui/src/components/Properties/Properties.module.css'),
    'utf8',
  );

  it('drops the native steppers on a property-row number field', () => {
    expect(sheet).toMatch(
      /\.row input\[type='number'\]::-webkit-inner-spin-button[^}]*-webkit-appearance: none;/,
    );
    expect(sheet).toMatch(/\.row input\[type='number'\]:not\(\.readoutInput\)[^}]*appearance: textfield;/);
  });
});
