import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFieldControl, type OwnFieldSemantics } from '../Field/fieldSemantics';
import { PropertyField } from './PropertyField';
import { PropertyRow } from './PropertyRow';
import { RowScope } from './rowScope';
import { trigger } from '../../testing/selectRow';

const none = (): void => {};
const options = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

/** A consumer's control in a row of its own, reading the row through the hook. */
function Knob(props: OwnFieldSemantics) {
  return <div role="slider" aria-valuenow={3} tabIndex={0} {...useFieldControl(props)} />;
}

// The label is written once, and the control is named by the row's label element rather than by a copy of it.
describe('a property field names its control from its one label', () => {
  it.each([
    ['number', () => <PropertyField kind="number" label="Size" value={1} onChange={none} />, 'spinbutton'],
    ['slider', () => <PropertyField kind="number" control="slider" label="Size" value={1} min={0} max={9} onChange={none} />, 'slider'],
    ['string', () => <PropertyField kind="string" label="Size" value="x" onChange={none} />, 'textbox'],
    ['textarea', () => <PropertyField kind="string" control="textarea" label="Size" value="x" onChange={none} />, 'textbox'],
    ['checkbox', () => <PropertyField kind="boolean" label="Size" value onChange={none} />, 'checkbox'],
    ['switch', () => <PropertyField kind="boolean" control="switch" label="Size" value onChange={none} />, 'switch'],
    ['radio', () => <PropertyField kind="enum" control="radio" label="Size" value="a" options={options} onChange={none} />, 'radiogroup'],
  ] as const)('%s', (_, make, role) => {
    render(make());
    const control = screen.getByRole(role, { name: 'Size' });
    expect(control).toHaveAttribute('aria-labelledby');
    expect(control).not.toHaveAttribute('aria-label');
    expect(screen.getAllByText('Size')).toHaveLength(1);
  });

  it('names a select trigger from its label', () => {
    render(<PropertyField kind="enum" label="Mode" value="a" options={options} onChange={none} />);
    // Its name is the value, then the label.
    expect(trigger('Mode')).toHaveAccessibleName('Alpha Mode');
    expect(screen.getAllByText('Mode')).toHaveLength(1);
  });

  it('names its control from a label that is not text', () => {
    render(<PropertyField kind="number" label={<em>Size</em>} value={1} onChange={none} />);
    expect(screen.getByRole('spinbutton', { name: 'Size' })).toBeInTheDocument();
  });

  it('points the row label at the control', () => {
    const { container } = render(<PropertyField kind="number" label="Size" value={1} onChange={none} />);
    const row = container.querySelector('label')!;
    expect(row.htmlFor).toBe(screen.getByRole('spinbutton').id);
  });

  it('is described by its help and by its error', () => {
    render(
      <RowScope error="Too big.">
        <PropertyField kind="number" label="Size" description="In points." value={1} onChange={none} />
      </RowScope>,
    );
    const field = screen.getByRole('spinbutton', { name: 'Size' });
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Too big.'));
    expect(field).toHaveAccessibleDescription(expect.stringContaining('In points.'));
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps a name given to it', () => {
    render(<PropertyField kind="number" label="Size" name="Font size" value={1} onChange={none} />);
    expect(screen.getByRole('spinbutton')).toHaveAccessibleName('Font size');
  });
});

describe('a control of the consumer’s own in a PropertyRow', () => {
  it('takes its name and error from the row', () => {
    render(
      <RowScope error="Out of range.">
        <PropertyRow label="Gain">
          <Knob />
        </PropertyRow>
      </RowScope>,
    );
    const knob = screen.getByRole('slider', { name: 'Gain' });
    expect(knob).toHaveAccessibleDescription('Out of range.');
  });

  it('keeps each member of a group row named by itself', () => {
    render(
      <PropertyRow label="Position" group>
        <Knob aria-label="X" />
        <Knob aria-label="Y" />
      </PropertyRow>,
    );
    expect(screen.getAllByRole('slider').map((k) => k.getAttribute('aria-label'))).toEqual(['X', 'Y']);
    expect(screen.getAllByRole('slider').every((k) => !k.hasAttribute('id'))).toBe(true);
  });
});
