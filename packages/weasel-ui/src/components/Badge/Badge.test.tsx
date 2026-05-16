import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders label as a span by default', () => {
    const { container, getByText } = render(<Badge>hello</Badge>);
    expect(getByText('hello')).toBeDefined();
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('applies tone via data-tone attribute', () => {
    const { container } = render(<Badge tone="accent">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-tone')).toBe('accent');
  });

  it('applies variant via data-variant attribute', () => {
    const { container } = render(<Badge variant="solid">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('solid');
  });

  it('applies size via data-size attribute', () => {
    const { container } = render(<Badge size="md">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-size')).toBe('md');
  });

  it('renders an svg decoration layer', () => {
    const { container } = render(<Badge shape="pill">x</Badge>);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('Badge content slots', () => {
  it('renders a dot when dot prop set', () => {
    const { container } = render(<Badge dot>x</Badge>);
    expect(container.querySelector('[data-badge-dot]')).not.toBeNull();
  });

  it('renders leading icon node', () => {
    const { getByTestId } = render(
      <Badge leadingIcon={<span data-testid="icon">i</span>}>x</Badge>,
    );
    expect(getByTestId('icon')).toBeDefined();
  });

  it('applies shape insets as CSS custom properties', () => {
    const { container } = render(<Badge shape="banner">x</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--badge-inset-left')).toBe('10px');
    expect(el.style.getPropertyValue('--badge-inset-right')).toBe('10px');
  });
});
