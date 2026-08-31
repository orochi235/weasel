import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyGroup } from './PropertyGroup';

describe('PropertyGroup', () => {
  it('renders title and children', () => {
    render(
      <PropertyGroup title="Aqua">
        <div>child</div>
      </PropertyGroup>,
    );
    expect(screen.getByText('Aqua')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });

  it('renders nothing when hidden is true', () => {
    const { container } = render(
      <PropertyGroup title="Bevel" hidden>
        <div>child</div>
      </PropertyGroup>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('applies subpanel class', () => {
    const { container } = render(
      <PropertyGroup title="Dome">
        <div>x</div>
      </PropertyGroup>,
    );
    expect(container.firstChild).toHaveClass('lk-property-group');
  });
});
