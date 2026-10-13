import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PropertyList } from './PropertyList';
import { PropertyPanel } from './PropertyPanel';
import { PropertyRow } from './PropertyRow';
import s from './Properties.module.css';

describe('PropertyPanel', () => {
  it('renders title and children', () => {
    render(
      <PropertyPanel title="Shape">
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyPanel>,
    );
    expect(screen.getByRole('heading', { name: 'Shape' })).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('omits the heading when no title is given', () => {
    const { container } = render(
      <PropertyPanel>
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyPanel>,
    );
    expect(container.querySelector(`.${s.panelTitle}`)).toBeNull();
  });

  it('renders children directly (no implicit grid)', () => {
    const { container } = render(
      <PropertyPanel>
        <span>raw child</span>
      </PropertyPanel>,
    );
    expect(container.querySelector(`.${s.list}`)).toBeNull();
    expect(screen.getByText('raw child')).toBeInTheDocument();
  });
});

describe('PropertyList', () => {
  it('renders a grid container', () => {
    const { container } = render(
      <PropertyList>
        <PropertyRow label="A">
          <input type="text" defaultValue="x" />
        </PropertyRow>
      </PropertyList>,
    );
    expect(container.querySelector(`.${s.list}`)).not.toBeNull();
  });
});
