import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertyGroup } from './PropertyGroup';
import s from './Properties.module.css';

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
    expect(container.firstChild).toHaveClass(s.group);
  });
});

describe('PropertyGroup collapse', () => {
  it('draws no twisty unless asked for one', () => {
    render(
      <PropertyGroup title="Aqua">
        <div>child</div>
      </PropertyGroup>,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('starts folded on defaultCollapsed and opens from the twisty', () => {
    render(
      <PropertyGroup title="Aqua" defaultCollapsed>
        <div>child</div>
      </PropertyGroup>,
    );
    expect(screen.getByText('child')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Aqua' }));
    expect(screen.getByText('child')).toBeVisible();
  });

  it('points the twisty at the body it opens', () => {
    render(
      <PropertyGroup title="Aqua" collapsible>
        <div>child</div>
      </PropertyGroup>,
    );
    const twisty = screen.getByRole('button', { name: 'Aqua' });
    expect(twisty).toHaveAttribute('aria-expanded', 'true');
    const controls = twisty.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toContainElement(
      screen.getByText('child'),
    );
  });

  it('leaves a controlled group folded until the consumer says otherwise', () => {
    const onCollapsedChange = vi.fn();
    render(
      <PropertyGroup title="Aqua" collapsed onCollapsedChange={onCollapsedChange}>
        <div>child</div>
      </PropertyGroup>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aqua' }));
    expect(onCollapsedChange).toHaveBeenCalledWith(false);
    expect(screen.getByText('child')).not.toBeVisible();
  });

  it('keeps the rows mounted while folded', () => {
    render(
      <PropertyGroup title="Aqua" defaultCollapsed>
        <input type="text" defaultValue="typed" />
      </PropertyGroup>,
    );
    expect(screen.getByDisplayValue('typed')).toBeInTheDocument();
  });
});
