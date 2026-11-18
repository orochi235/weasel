import { useState, type InputHTMLAttributes } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Field, useFieldControl, type FieldProps } from '@weasel-js/ui/components/Field';
import { Slider, type Thumb } from '@weasel-js/ui/components/Slider';
import { UnitField } from '@weasel-js/ui/components/NumberField';

const meta: Meta<typeof Field> = {
  title: 'ui/Field',
  component: Field,
};
export default meta;

type Story = StoryObj<typeof Field>;

/** A native input of a consumer's own, which takes the field's id, name and description through the hook. */
function NativeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} {...useFieldControl()} />;
}

export const Stacked: Story = {
  args: { orientation: 'stacked', label: 'Width', description: 'In document units.' },
  render: (args) => <Field {...args}><NativeInput defaultValue="120" /></Field>,
};

export const Row: Story = {
  args: { orientation: 'row', label: 'Snap to grid' },
  render: (args) => <Field {...args}><NativeInput type="checkbox" defaultChecked /></Field>,
};

export const WithError: Story = {
  args: { label: 'Name', error: 'Name is required.' },
  render: (args) => <Field {...args}><NativeInput defaultValue="" /></Field>,
};

function SliderField(args: FieldProps) {
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 20 }, { value: 80 }]);
  return (
    <Field {...args} output={thumbs.map((t) => Math.round(t.value)).join(' – ')}>
      <Slider min={0} max={100} step={1} constraint="ordered" thumbs={thumbs} onInput={setThumbs} />
    </Field>
  );
}

/** `label` and `output` give any control a label-and-value header; here, a two-thumb `Slider` the label names. */
export const WithOutput: Story = {
  args: { label: 'Range' },
  render: (args) => <SliderField {...args} />,
};

function SizeField(args: FieldProps) {
  const [size, setSize] = useState({ width: 210, height: 297 });
  return (
    <Field {...args}>
      <UnitField aria-label="Width" value={size.width} onChange={(width) => setSize({ ...size, width })} />
      <UnitField aria-label="Height" value={size.height} onChange={(height) => setSize({ ...size, height })} />
    </Field>
  );
}

/** A field of several controls is a `group` its label names, and each control names itself. */
export const Group: Story = {
  args: { label: 'Page size', description: 'In millimeters.', group: true, orientation: 'row' },
  render: (args) => <SizeField {...args} />,
};
