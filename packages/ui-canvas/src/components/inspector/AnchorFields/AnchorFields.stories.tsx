import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { AnchorField, AnchorFieldValues, NumberEntry } from '@weasel-js/geom';
import { AnchorFields, type AnchorFieldsProps } from '@weasel-js/ui-canvas/components/inspector/AnchorFields';

const meta: Meta<typeof AnchorFields> = {
  title: 'ui-canvas/inspector/AnchorFields',
  component: AnchorFields,
};
export default meta;
type Story = StoryObj<typeof AnchorFields>;

const POINTS = { pt: 1, in: 72, mm: 72 / 25.4 };

/** Fields over stand-in anchors, writing back into each the way a canvas would: a field reads Mixed where
 *  the anchors disagree, and `+=` moves each by the amount. */
function Stand({ anchors: initial, ...args }: AnchorFieldsProps & { anchors: readonly AnchorFieldValues[] }) {
  const [anchors, setAnchors] = useState(initial);
  const values: AnchorFieldValues = {};
  for (const field of Object.keys(anchors[0]!) as AnchorField[]) {
    const all = anchors.map((a) => a[field]);
    values[field] = all.every((v) => v === all[0]) ? all[0] : null;
  }
  const write = (field: AnchorField, entry: NumberEntry) => setAnchors((list) => list.map((a) => {
    const now = a[field];
    if (now === undefined) return a;
    return { ...a, [field]: 'to' in entry ? entry.to : (now ?? 0) + entry.by };
  }));
  return <AnchorFields accepts={POINTS} unit="pt" {...args} fields={{ values, write }} />;
}

/** Two anchors on one horizontal: Y reads one number, X reads Mixed. Type
 *  `+=10` into X to move both, or `1in` into Y. */
export const SeveralAnchors: Story = {
  render: (args) => <Stand {...args} anchors={[{ x: 100, y: 120 }, { x: 160, y: 120 }]} />,
};

/** One anchor with both handles. The Handles toggle switches them between
 *  points and angle and length. */
export const OneAnchor: Story = {
  render: (args) => (
    <Stand {...args} anchors={[{
      x: 100, y: 100,
      inX: 80, inY: 110, inAngle: 153.43, inLength: 22.36,
      outX: 130, outY: 90, outAngle: 18.43, outLength: 31.62,
    }]} />
  ),
};
