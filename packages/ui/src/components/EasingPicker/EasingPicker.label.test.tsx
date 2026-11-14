import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PropertyRow } from '../Properties/PropertyRow';
import { EasingPicker } from './EasingPicker';

describe('EasingPicker label', () => {
  it('draws its own "Easing" label standing alone', () => {
    const { container } = render(<EasingPicker value={undefined} onChange={() => {}} />);
    expect(container.textContent).toContain('Easing');
    expect(screen.getByRole('combobox', { name: 'Easing' })).toBeTruthy();
  });

  it('draws no label of its own inside a row, and takes the row’s for its name', () => {
    const { container } = render(
      <PropertyRow group label="fade ease">
        <EasingPicker value={undefined} onChange={() => {}} />
      </PropertyRow>,
    );
    expect(container.textContent).not.toContain('Easing');
    expect(container.querySelectorAll('label')).toHaveLength(0);
    expect(screen.getByRole('combobox', { name: 'fade ease' })).toBeTruthy();
  });

  it('omits the label when told to, keeping a name', () => {
    const { container } = render(<EasingPicker value={undefined} onChange={() => {}} label={false} />);
    expect(container.textContent).not.toContain('Easing');
    expect(screen.getByRole('combobox', { name: 'Easing' })).toBeTruthy();
  });

  it('takes a label of its own words', () => {
    render(<EasingPicker value={undefined} onChange={() => {}} label="Curve" />);
    expect(screen.getByRole('combobox', { name: 'Curve' })).toBeTruthy();
  });
});
