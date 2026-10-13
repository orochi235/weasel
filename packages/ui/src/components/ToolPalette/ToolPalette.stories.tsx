import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ToolPalette, type ToolPaletteProps } from './ToolPalette';
import type { Tool, ToolsApi } from '@weasel-js/core';
import {
  SelectIcon,
  LassoIcon,
  RectIcon,
  TextIcon,
  PenIcon,
  HandIcon,
} from '@weasel-js/core';

const meta: Meta<typeof ToolPalette> = {
  title: 'ui/ToolPalette',
  component: ToolPalette,
};
export default meta;

type Story = StoryObj<typeof ToolPalette>;

function fullList(): Tool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon />, group: 'select' } } as Tool,
    { id: 'lasso',  keybinding: { key: 'l' }, presentation: { label: 'Lasso',  icon: <LassoIcon />,  group: 'select' } } as Tool,
    { id: 'rect',   keybinding: { key: 'r' }, presentation: { label: 'Rect',   icon: <RectIcon />,   group: 'shape'  } } as Tool,
    { id: 'text',   keybinding: { key: 't' }, presentation: { label: 'Text',   icon: <TextIcon />,   group: 'type'   } } as Tool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon />,    group: 'draw'   } } as Tool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon />,   group: 'view'   } } as Tool,
  ];
}

function minimalList(): Tool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon /> } } as Tool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon /> } } as Tool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon /> } } as Tool,
  ];
}

function makeFakeToolsApi(list: Tool[], active: string, setActive: (id: string) => void): ToolsApi {
  const registry: Record<string, Tool> = Object.fromEntries(list.map((t) => [t.id, t]));
  return {
    registry,
    active,
    setActive,
  } as unknown as ToolsApi;
}

function FullDemo(props: Partial<ToolPaletteProps>) {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(fullList(), active, setActive);
  return <ToolPalette {...props} tools={tools} />;
}

function MinimalDemo(props: Partial<ToolPaletteProps>) {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(minimalList(), active, setActive);
  return <ToolPalette {...props} tools={tools} />;
}

export const Default: Story = { render: (args) => <FullDemo {...args} /> };
export const Horizontal: Story = {
  args: { orientation: 'horizontal' },
  render: (args) => <FullDemo {...args} />,
};
export const Minimal: Story = { render: (args) => <MinimalDemo {...args} /> };

// Focus the active tool and try ArrowDown / ArrowUp / Home / End — the
// palette manages a roving tabindex across all buttons regardless of group.
export const KeyboardNav: Story = {
  render: (args) => <FullDemo {...args} />,
  parameters: {
    docs: {
      description: {
        story:
          'Click the active tool to give it focus, then use Arrow keys, Home, or End to move focus across the palette. Only the active tool participates in the page tab order; arrow keys move within the toolbar (roving tabindex per WAI-ARIA toolbar pattern).',
      },
    },
  },
};
