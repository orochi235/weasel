import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '../Checkbox/Checkbox';
import { ComboBox } from '../ComboBox/ComboBox';
import { InlineRange } from '../InlineRange/InlineRange';
import { Input } from '../Input/Input';
import { NumberField } from '../NumberField/NumberField';
import { UnitField } from '../NumberField/UnitField';
import { SegmentedBar } from '../Segmented/SegmentedBar';
import { Select } from '../Select/Select';
import { Slider } from '../Slider';
import { Switch } from '../Switch/Switch';
import { TextArea } from '../TextArea/TextArea';
import { renderWithIcons } from '../../testing/withIcons';
import { Field } from './Field';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];
const none = (): void => {};

// Each control written with no name of its own: the field's one label names it.
const controls: Array<[string, () => ReactElement, () => HTMLElement]> = [
  ['Input', () => <Input />, () => screen.getByRole('textbox')],
  ['TextArea', () => <TextArea />, () => screen.getByRole('textbox')],
  ['NumberField', () => <NumberField />, () => screen.getByRole('textbox')],
  ['UnitField', () => <UnitField value={1} onChange={none} />, () => screen.getByRole('spinbutton')],
  ['ComboBox', () => <ComboBox options={OPTIONS} />, () => screen.getByRole('combobox')],
  ['Select', () => <Select options={OPTIONS} />, () => screen.getAllByRole('button')[0]!],
  ['Slider', () => <Slider min={0} max={10} thumbs={[{ value: 3 }]} onInput={none} />, () => screen.getByRole('slider')],
  ['Switch', () => <Switch />, () => screen.getByRole('switch')],
  ['Checkbox', () => <Checkbox />, () => screen.getByRole('checkbox')],
  ['InlineRange', () => <InlineRange value={3} onChange={none} />, () => screen.getByRole('slider')],
  ['SegmentedBar', () => <SegmentedBar items={OPTIONS} value="a" onChange={none} />, () => screen.getByRole('radiogroup')],
];

describe.each(controls)('%s in a Field', (_, make, control) => {
  it('is named by the field label, written once', () => {
    renderWithIcons(<Field label="Amount">{make()}</Field>);
    expect(control()).toHaveAccessibleName(expect.stringContaining('Amount'));
    expect(screen.getAllByText('Amount')).toHaveLength(1);
  });

  it('is described by the field description and error', () => {
    renderWithIcons(<Field label="Amount" description="Per item." error="Too many.">{make()}</Field>);
    expect(control()).toHaveAccessibleDescription(expect.stringContaining('Per item. Too many.'));
  });
});

describe('a control with a name of its own in a Field', () => {
  it('keeps it', () => {
    renderWithIcons(<Field label="Amount"><Input aria-label="Count" /></Field>);
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Count');
  });

  it('keeps a SegmentedBar named by its own aria-label', () => {
    renderWithIcons(<Field label="Amount"><SegmentedBar aria-label="Policy" items={OPTIONS} value="a" onChange={none} /></Field>);
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('Policy');
  });

  it('keeps its own label', () => {
    renderWithIcons(<Field><NumberField label="Count" /></Field>);
    expect(screen.getByRole('textbox')).toHaveAccessibleName('Count');
  });
});

describe('a compound field', () => {
  it('names its group, and each member names itself', () => {
    renderWithIcons(
      <Field label="Size" group>
        <UnitField aria-label="Width" value={1} onChange={none} />
        <UnitField aria-label="Height" value={2} onChange={none} />
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Size' })).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton').map((el) => el.getAttribute('aria-label'))).toEqual(['Width', 'Height']);
  });

  it('marks its members invalid by neither name nor error', () => {
    renderWithIcons(
      <Field label="Size" error="Too wide." group>
        <UnitField aria-label="Width" value={1} onChange={none} />
      </Field>,
    );
    expect(screen.getByRole('group', { name: 'Size' })).toHaveAccessibleDescription('Too wide.');
    expect(screen.getByRole('spinbutton')).not.toHaveAttribute('aria-invalid');
  });
});
