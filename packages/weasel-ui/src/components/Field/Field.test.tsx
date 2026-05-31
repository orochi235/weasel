import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Field, fieldClasses } from './Field';

describe('Field', () => {
  it('renders children inside a stacked container by default', () => {
    const { container } = render(<Field><span>x</span></Field>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(fieldClasses.root);
    expect(root.className).not.toContain(fieldClasses.row);
  });

  it('applies the row layout class when orientation="row"', () => {
    const { container } = render(<Field orientation="row"><span>x</span></Field>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(fieldClasses.row);
  });

  it('forwards a custom className', () => {
    const { container } = render(<Field className="extra"><span>x</span></Field>);
    expect((container.firstElementChild as HTMLElement).className).toContain('extra');
  });
});
