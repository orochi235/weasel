import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToolPalette } from './ToolPalette';
import type { AnyTool, ToolsApi } from '@weasel-js/core';
import {
  SelectIcon,
  LassoIcon,
  RectIcon,
  TextIcon,
  PenIcon,
  HandIcon,
} from '@weasel-js/core';

const meta: Meta<typeof ToolPalette> = {
  title: 'weasel-ui/ToolPalette',
  component: ToolPalette,
};
export default meta;

type Story = StoryObj<typeof ToolPalette>;

function fullList(): AnyTool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon />, group: 'select' } } as AnyTool,
    { id: 'lasso',  keybinding: { key: 'l' }, presentation: { label: 'Lasso',  icon: <LassoIcon />,  group: 'select' } } as AnyTool,
    { id: 'rect',   keybinding: { key: 'r' }, presentation: { label: 'Rect',   icon: <RectIcon />,   group: 'shape'  } } as AnyTool,
    { id: 'text',   keybinding: { key: 't' }, presentation: { label: 'Text',   icon: <TextIcon />,   group: 'type'   } } as AnyTool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon />,    group: 'draw'   } } as AnyTool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon />,   group: 'view'   } } as AnyTool,
  ];
}

function minimalList(): AnyTool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon /> } } as AnyTool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon /> } } as AnyTool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon /> } } as AnyTool,
  ];
}

function makeFakeToolsApi(list: AnyTool[], active: string, setActive: (id: string) => void): ToolsApi {
  const registry: Record<string, AnyTool> = Object.fromEntries(list.map((t) => [t.id, t]));
  return {
    registry,
    active,
    setActive,
  } as unknown as ToolsApi;
}

function FullDemo({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(fullList(), active, setActive);
  return <ToolPalette tools={tools} orientation={orientation} />;
}

function MinimalDemo() {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(minimalList(), active, setActive);
  return <ToolPalette tools={tools} />;
}

export const Default: Story = { render: () => <FullDemo /> };
export const Horizontal: Story = { render: () => <FullDemo orientation="horizontal" /> };
export const Minimal: Story = { render: () => <MinimalDemo /> };

// Focus the active tool and try ArrowDown / ArrowUp / Home / End — the
// palette manages a roving tabindex across all buttons regardless of group.
export const KeyboardNav: Story = {
  render: () => <FullDemo />,
  parameters: {
    docs: {
      description: {
        story:
          'Click the active tool to give it focus, then use Arrow keys, Home, or End to move focus across the palette. Only the active tool participates in the page tab order; arrow keys move within the toolbar (roving tabindex per WAI-ARIA toolbar pattern).',
      },
    },
  },
};
