import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { AnchorField, AnchorFieldValues, NumberEntry } from '@weasel-js/core';
import { AnchorFields, type AnchorFieldsProps } from '@weasel-js/ui/components/AnchorFields';

const meta: Meta<typeof AnchorFields> = {
  title: 'ui/AnchorFields',
  component: AnchorFields,
};
export default meta;
type Story = StoryObj<typeof AnchorFields>;

const POINTS = { pt: 1, in: 72, mm: 72 / 25.4 };

/** Fields over stand-in values, writing back into them the way a canvas would. */
function Stand({ initial, ...args }: AnchorFieldsProps & { initial: AnchorFieldValues }) {
  const [values, setValues] = useState(initial);
  const write = (field: AnchorField, entry: NumberEntry) => setValues((v) => {
    const now = v[field];
    if (now === undefined) return v;
    return { ...v, [field]: 'to' in entry ? entry.to : (now ?? 0) + entry.by };
  });
  return <AnchorFields accepts={POINTS} unit="pt" {...args} fields={{ values, write }} />;
}

/** Two anchors on one horizontal: Y reads one number, X reads Mixed. Type
 *  `+=10` into X to move both, or `1in` into Y. */
export const SeveralAnchors: Story = {
  render: (args) => <Stand {...args} initial={{ x: null, y: 120 }} />,
};

/** One anchor with both handles. The Handles toggle switches them between
 *  points and angle and length. */
export const OneAnchor: Story = {
  render: (args) => (
    <Stand {...args} initial={{
      x: 100, y: 100,
      inX: 80, inY: 110, inAngle: 153.43, inLength: 22.36,
      outX: 130, outY: 90, outAngle: 18.43, outLength: 31.62,
    }} />
  ),
};
