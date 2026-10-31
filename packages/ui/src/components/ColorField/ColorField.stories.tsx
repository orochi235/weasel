import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ColorField } from '@weasel-js/ui/components/ColorField';

const meta: Meta<typeof ColorField> = {
  title: 'ui/Foundations/ColorField',
  component: ColorField,
  args: { alpha: false, disabled: false, mixed: false },
};
export default meta;

type Story = StoryObj<typeof ColorField>;

/** The swatch opens the platform's color picker; one change per gesture. */
export const Default: Story = {
  render: (args) => {
    const [color, setColor] = useState('#3a7bd5');
    return <ColorField aria-label="Fill" {...args} value={color} onInput={setColor} onChange={setColor} />;
  },
};

/** With `alpha`, an opacity slider follows the swatch, and the value is `#rrggbbaa`. */
export const WithAlpha: Story = {
  args: { alpha: true },
  render: (args) => {
    const [color, setColor] = useState('#3a7bd5b3');
    return <ColorField aria-label="Fill" {...args} value={color} onInput={setColor} onChange={setColor} />;
  },
};

/** Colors that differ: a checkered chip, and the opacity slider held off until a color is picked. */
export const Mixed: Story = {
  args: { mixed: true, alpha: true, onChange: () => {}, 'aria-label': 'Fill' },
};
