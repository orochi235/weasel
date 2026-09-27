import type { Meta, StoryObj } from '@weasel-js/forge';
import { KIT_SHAPE_KINDS } from '@weasel-js/core';
import { ToolIcon } from './ToolIcon';
import s from './ToolIcon.stories.module.css';

const meta: Meta<typeof ToolIcon> = {
  title: 'draw/ToolIcon',
  component: ToolIcon,
};
export default meta;

type Story = StoryObj<typeof ToolIcon>;

/** Pick a tool; any id outside the kit's shape tools draws the unknown glyph. */
export const Default: Story = { args: { tool: 'rect', size: 20 } };

/** `image` is a shape tool `useBuiltinShapeTools` does not mount, so it sits
 *  outside `KIT_SHAPE_KINDS`; `custom` stands in for a consumer-defined tool. */
export const EveryTool: Story = {
  tags: ['gallery'],
  render: () => (
    <div className={s.sheet}>
      {[...KIT_SHAPE_KINDS, 'image', 'custom'].map((tool) => (
        <figure key={tool}>
          <ToolIcon tool={tool} />
          <figcaption>{tool}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
