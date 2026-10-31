import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { solid, type Inherit, type Paint } from '@weasel-js/core';
import { PaintInput } from '@weasel-js/ui/components/PaintInput';

const meta: Meta<typeof PaintInput> = {
  title: 'ui/Foundations/PaintInput',
  component: PaintInput,
  args: { allowNone: true, mixed: false, unset: false },
};
export default meta;

type Story = StoryObj<typeof PaintInput>;

type LiveArgs = Omit<Parameters<typeof PaintInput>[0], 'value' | 'onChange' | 'onInput'>;

function Live({ initial, ...args }: LiveArgs & { initial: Paint | Inherit | null }) {
  const [paint, setPaint] = useState<Paint | Inherit | null>(initial);
  return <PaintInput aria-label="Fill" {...args} value={paint} onInput={setPaint} onChange={setPaint} />;
}

/** A solid paint: the kind bar over a color field and an opacity slider. Switching kinds and back keeps each kind's paint. */
export const Default: Story = {
  render: (args) => <Live {...args} initial={solid('#3a7bd5ff')} />,
};

/** A gradient opens the gradient editor under the bar. */
export const Gradient: Story = {
  render: (args) => (
    <Live
      {...args}
      initial={{
        kind: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 0 },
        units: 'bounds',
        stops: [
          { offset: 0, color: '#f2545bff' },
          { offset: 1, color: '#2d7dd2ff' },
        ],
      }}
    />
  ),
};

/** With `inherit`, an "Inherit" segment sits beside "None", and picking it shows the paint it takes. */
export const Inheriting: Story = {
  render: (args) => {
    const [paint, setPaint] = useState<Paint | Inherit | null>('inherit');
    return (
      <PaintInput
        aria-label="Fill"
        {...args}
        value={paint}
        inherit={{ paint: solid('#34c759ff'), onInherit: () => setPaint('inherit') }}
        onInput={setPaint}
        onChange={setPaint}
      />
    );
  },
};
