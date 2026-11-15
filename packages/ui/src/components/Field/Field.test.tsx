import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field, fieldClasses } from './Field';
import { useFieldControl, type OwnFieldSemantics } from './fieldSemantics';

/** A control of a consumer's own, which reads its field through the hook. */
function Knob(props: OwnFieldSemantics) {
  return <div role="slider" aria-valuenow={3} tabIndex={0} {...useFieldControl(props)} />;
}

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

  it('names a custom single control from its one label, and is no group', () => {
    render(<Field label="Gain"><Knob /></Field>);
    expect(screen.getByRole('slider')).toHaveAccessibleName('Gain');
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getAllByText('Gain')).toHaveLength(1);
  });

  it('describes the control by its description and error, and marks it invalid', () => {
    render(<Field label="Gain" description="In decibels." error="Too loud."><Knob /></Field>);
    const knob = screen.getByRole('slider');
    expect(knob).toHaveAccessibleName('Gain');
    expect(knob).toHaveAccessibleDescription('In decibels. Too loud.');
    expect(knob).toHaveAttribute('aria-invalid', 'true');
  });

  it('hands its control an id, so a consumer can point at it', () => {
    render(<Field label="Gain"><Knob /></Field>);
    expect(screen.getByRole('slider').id).not.toBe('');
  });

  it('leaves a control that names itself alone', () => {
    render(<Field label="Gain" description="d"><Knob aria-label="Trim" /></Field>);
    const knob = screen.getByRole('slider');
    expect(knob).toHaveAccessibleName('Trim');
    expect(knob).not.toHaveAttribute('aria-describedby');
  });

  it('shows no error for an empty one', () => {
    render(<Field label="Gain" error=""><Knob /></Field>);
    expect(screen.getByRole('slider')).not.toHaveAttribute('aria-invalid');
  });

  describe('group', () => {
    it('is a group named and described by the field, its members named by themselves', () => {
      render(
        <Field label="Position" description="From the page's corner." group>
          <Knob aria-label="X" />
          <Knob aria-label="Y" />
        </Field>,
      );
      const group = screen.getByRole('group', { name: 'Position' });
      expect(group).toHaveAccessibleDescription("From the page's corner.");
      expect(screen.getAllByRole('slider').map((k) => k.getAttribute('aria-label'))).toEqual(['X', 'Y']);
    });

    it('hands an unnamed member nothing', () => {
      render(<Field label="Position" group><Knob /></Field>);
      const knob = screen.getByRole('slider');
      expect(knob).not.toHaveAttribute('aria-labelledby');
      expect(knob).not.toHaveAttribute('id');
    });
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
