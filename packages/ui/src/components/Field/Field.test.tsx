import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, fieldClasses } from './Field';

describe('Field', () => {
  it('renders children inside a stacked container by default', () => {
    const { container } = render(<Field><span>x</span></Field>);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain(fieldClasses.root);
    expect(root.className).not.toContain(fieldClasses.row);
  });

  it('forwards a custom className', () => {
    const { container } = render(<Field className="extra"><span>x</span></Field>);
    expect((container.firstElementChild as HTMLElement).className).toContain('extra');
  });

  it('names a group with its label', () => {
    render(<Field label="Opacity"><input aria-label="Opacity value" /></Field>);
    expect(screen.getByRole('group', { name: 'Opacity' })).toContainElement(screen.getByLabelText('Opacity value'));
  });

  it('is no group without a label', () => {
    render(<Field><input aria-label="x" /></Field>);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('shows the output on the label line, ahead of a stacked control', () => {
    const { container } = render(<Field label="Opacity" output="75%"><input aria-label="v" /></Field>);
    const out = container.querySelector('output')!;
    expect(out).toHaveTextContent('75%');
    expect(out.getAttribute('aria-live')).toBe('off');
    expect(out.compareDocumentPosition(screen.getByLabelText('v')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the output after the control in a row', () => {
    const { container } = render(<Field orientation="row" label="Opacity" output="75%"><input aria-label="v" /></Field>);
    const root = container.firstElementChild!;
    expect(root.lastElementChild!.tagName).toBe('OUTPUT');
  });
});
