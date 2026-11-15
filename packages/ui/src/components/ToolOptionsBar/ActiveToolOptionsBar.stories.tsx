import type { Meta, StoryObj } from '@weasel-js/forge';
import { createToolOptionValues, defineTool, shareToolOptions, type ToolOptions } from '@weasel-js/core';
import { pref, PX_UNIT } from '@weasel-js/prefs';
import { useState } from 'react';
import { ActiveToolOptionsBar } from '@weasel-js/ui/components/ToolOptionsBar';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof ActiveToolOptionsBar> = {
  title: 'ui/ToolOptionsBar/ActiveToolOptionsBar',
  component: ActiveToolOptionsBar,
};
export default meta;

type Story = StoryObj<typeof ActiveToolOptionsBar>;

const brushOptions = (label: string, id: string, share: boolean): ToolOptions => {
  const own: ToolOptions = {
    actionId: id,
    prefs: pref.group(label, {
      radiusPx: pref.number('Size', 16, { min: 4, max: 120, step: 1, control: 'slider', unit: PX_UNIT }),
      hardness: pref.number('Hardness', 0.5, { min: 0, max: 1, step: 0.05, control: 'slider' }),
    }),
  };
  return share ? shareToolOptions(own, { radiusPx: 'brush.size' }) : own;
};

const REGISTRY = {
  paint: defineTool({ id: 'paint', presentation: { label: 'Paint' }, options: brushOptions('Paint', 'paint', true) }),
  erase: defineTool({ id: 'erase', presentation: { label: 'Erase' }, options: brushOptions('Erase', 'erase', true) }),
  select: defineTool({ id: 'select', presentation: { label: 'Select' } }),
};

// Two brushes sharing their size, and a tool with no options, which empties the bar.
export const FollowsTheActiveTool: Story = {
  render: (args) => {
    const [values] = useState(createToolOptionValues);
    const [active, setActive] = useState<keyof typeof REGISTRY>('paint');
    return (
      <div>
        {(Object.keys(REGISTRY) as (keyof typeof REGISTRY)[]).map((id) => (
          <Button key={id} size="sm" pressed={active === id} onClick={() => setActive(id)}>{REGISTRY[id].presentation?.label}</Button>
        ))}
        <ActiveToolOptionsBar {...args} tools={{ active, registry: REGISTRY }} values={values} />
      </div>
    );
  },
};
