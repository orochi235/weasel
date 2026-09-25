import type { Meta, StoryObj } from '@weasel-js/forge';
import { KIT_SHAPE_KINDS } from '@weasel-js/core';
import { ShapeKindIcon } from './ShapeKindIcon';
import s from './icons.stories.module.css';

const meta: Meta<typeof ShapeKindIcon> = {
  title: 'ui/Icons/ShapeKindIcon',
  component: ShapeKindIcon,
};
export default meta;

type Story = StoryObj<typeof ShapeKindIcon>;

/** Pick a kind; any string outside the kit's set draws the unknown glyph. */
export const Default: Story = { args: { kind: 'rect', size: 20 } };

/** `image` is a shape kind with no auto-mounted tool, so it sits outside
 *  `KIT_SHAPE_KINDS`; `custom` stands in for a consumer-defined kind. */
export const EveryKind: Story = {
  render: () => (
    <div className={s.sheet}>
      {[...KIT_SHAPE_KINDS, 'image', 'custom'].map((kind) => (
        <figure key={kind}>
          <ShapeKindIcon kind={kind} />
          <figcaption>{kind}</figcaption>
        </figure>
      ))}
    </div>
  ),
};
