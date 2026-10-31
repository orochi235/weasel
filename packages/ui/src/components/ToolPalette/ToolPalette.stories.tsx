import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import { ToolPalette, type ToolPaletteProps } from '@weasel-js/ui/components/ToolPalette';
import { icon } from '../../icons.gen';

const meta: Meta<typeof ToolPalette> = {
  title: 'ui/ToolPalette',
  component: ToolPalette,
};
export default meta;

type Story = StoryObj<typeof ToolPalette>;

function fullList(): Tool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: icon('core:select'), group: 'select' } } as Tool,
    { id: 'lasso',  keybinding: { key: 'l' }, presentation: { label: 'Lasso',  icon: icon('core:lasso'),  group: 'select' } } as Tool,
    { id: 'rect',   keybinding: { key: 'r' }, presentation: { label: 'Rect',   icon: icon('core:rect'),   group: 'shape'  } } as Tool,
    { id: 'text',   keybinding: { key: 't' }, presentation: { label: 'Text',   icon: icon('core:text'),   group: 'type'   } } as Tool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: icon('core:pen'),    group: 'draw'   } } as Tool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: icon('core:hand'),   group: 'view'   } } as Tool,
  ];
}

function minimalList(): Tool[] {
  return [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: icon('core:select') } } as Tool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: icon('core:pen') } } as Tool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: icon('core:hand') } } as Tool,
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

const DRAWING = new Set(['rect', 'text', 'pen']);

function SplitDemo({ args }: { args: Story['args'] }) {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(fullList(), active, setActive);
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <ToolPalette {...args} tools={tools} include={(t) => !DRAWING.has(t.id)} />
      <ToolPalette {...args} tools={tools} include={(t) => DRAWING.has(t.id)} ariaLabel="Drawing tools" />
    </div>
  );
}

// One `tools`, two palettes: `include` splits the canvas's tools between them,
// and the active tool shows pressed in whichever palette holds it.
export const Split: Story = { render: (args) => <SplitDemo args={args} /> };

function stackedList(): Tool[] {
  const shape = (id: string, label: string, key: string, glyph: ReturnType<typeof icon>) =>
    ({ id, keybinding: { key }, presentation: { label, icon: glyph, group: 'shape' } }) as Tool;
  return [
    ...fullList().filter((t) => t.id !== 'rect'),
    shape('rect', 'Rect', 'm', icon('core:rect')),
    shape('ellipse', 'Ellipse', 'e', icon('core:ellipse')),
    shape('polygon', 'Polygon', 'g', icon('core:polygon')),
    shape('star', 'Star', 's', icon('core:star')),
    { id: 'pencil', keybinding: { key: 'n' }, presentation: { label: 'Pencil', icon: icon('core:pencil'), group: 'draw' } } as Tool,
  ];
}

function StackedDemo(props: Partial<ToolPaletteProps>) {
  const [active, setActive] = useState<string>('select');
  const tools = makeFakeToolsApi(stackedList(), active, setActive);
  return <ToolPalette stacks={[['rect', 'ellipse', 'polygon', 'star'], ['pen', 'pencil']]} {...props} tools={tools} />;
}

// A stack shares one button between related tools. Click it for a menu of them; Alt-click steps
// to the next one. The button keeps showing the tool last used from it.
export const Stacks: Story = { render: (args) => <StackedDemo {...args} /> };
