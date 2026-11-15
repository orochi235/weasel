import type { Meta, StoryObj } from '@weasel-js/forge';
import type { ReactElement } from 'react';
import { Button, type ButtonVariant, BUTTON_VARIANT_ICONS } from '@weasel-js/ui/components/Button';
import type { ControlSize } from '@weasel-js/ui/components/ControlSize';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { EMPHASIS_ICONS, GRADE_ICONS } from '../appearanceIcons';
import { EMPHASES, GRADES } from '@weasel-js/theme';
import { BADGE_LOOKS, lookProps } from '../Badge/looks';
import { Sequence, values } from '@weasel-js/ui/components/Sequence';
import s from './Button.stories.module.css';

const meta: Meta<typeof Button> = {
  title: 'ui/Button',
  component: Button,
  args: {
    children: 'Save',
    variant: 'solid',
    size: 'md',
  },
  argTypes: {
    grade: { control: { type: 'inline-radio', icons: GRADE_ICONS }, options: [undefined, ...GRADES] },
    emphasis: { control: { type: 'inline-radio', icons: EMPHASIS_ICONS }, options: [undefined, ...EMPHASES] },
    variant: { control: { type: 'inline-radio', icons: BUTTON_VARIANT_ICONS }, options: ['solid', 'ghost', 'link'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    iconOnly: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

const PlusIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 3v10M3 8h10" />
  </svg>
);

const ChevronIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const TrashIcon = (): ReactElement => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 4h10M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4l.5 8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8" />
  </svg>
);

export const Confirm: Story = { args: { stance: 'confirm' } };
export const Solid: Story = { args: { variant: 'solid' } };
export const Ghost: Story = { args: { variant: 'ghost' } };

/** `--wzl-gloss` at 1, the glass a theme opts into. The default theme sets 0 and draws these flat. */
export const Glass: Story = {
  render: (args) => (
    <div className={`${s.row} ${s.glossy}`}>
      <Button {...args} stance="confirm">Save</Button>
      <Button {...args}>Cancel</Button>
      <SegmentedBar
        aria-label="View"
        items={[
          { value: 'tree', label: 'Tree' },
          { value: 'list', label: 'List' },
        ]}
        value="tree"
        onChange={() => {}}
      />
    </div>
  ),
};

/** `link` takes its type from the surrounding text, so it sits inside a
 *  sentence or a table cell at whatever size that text is. */
export const Link: Story = {
  render: (args) => (
    <p className={s.prose}>
      Bound to <Button {...args} variant="link">editor.insert</Button>, which routes
      through <Button {...args} variant="link">routeTarget:scene</Button> and falls back
      to <Button {...args} variant="link" disabled>none</Button>.
    </p>
  ),
};

/** `grade` recolors a `link`, and `emphasis` mutes or sharpens it: accent unless told
 *  otherwise. */
export const LinkGrades: Story = {
  render: (args) => (
    <p className={`${s.prose} ${s.loose}`}>
      {BADGE_LOOKS.map((look) => (
        <span key={look}>
          <Button {...args} variant="link" {...lookProps(look)}>{look}</Button>{' '}
        </span>
      ))}
    </p>
  ),
};

/** `tint` says which of its peers a button is: a confirming button takes it as its
 *  accent, a link as its text color. */
export const PeerTints: Story = {
  render: (args) => (
    <div>
      <p>
        {[0, 1, 2, 3].map((tint) => (
          <span key={tint}>
            <Button {...args} stance="confirm" tint={tint}>{`Tint ${tint}`}</Button>{' '}
          </span>
        ))}
      </p>
      <p>
        {[0, 1, 2, 3].map((tint) => (
          <span key={tint}>
            <Button {...args} variant="link" tint={tint}>{`tint ${tint}`}</Button>{' '}
          </span>
        ))}
      </p>
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className={s.row}>
      <Button {...args} size="sm" stance="confirm">Small</Button>
      <Button {...args} size="md" stance="confirm">Medium</Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: (args) => (
    <div className={`${s.row} ${s.wraps}`}>
      <Button {...args} stance="confirm" leadingIcon={<PlusIcon />}>Add layer</Button>
      <Button {...args} trailingIcon={<ChevronIcon />}>Next</Button>
      <Button {...args} variant="ghost" leadingIcon={<TrashIcon />} trailingIcon={<ChevronIcon />}>
        Delete
      </Button>
    </div>
  ),
};

export const IconOnly: Story = {
  render: (args) => (
    <div className={s.row}>
      <Button {...args} iconOnly aria-label="Add" stance="confirm"><PlusIcon /></Button>
      <Button {...args} iconOnly aria-label="Add"><PlusIcon /></Button>
      <Button {...args} iconOnly aria-label="Add" variant="ghost"><PlusIcon /></Button>
      <Button {...args} iconOnly aria-label="Delete" size="sm"><TrashIcon /></Button>
    </div>
  ),
};

/** `shortcut` puts `Name (⌘Z)` in a kit tooltip; `tooltip` replaces the text. */
export const Tooltips: Story = {
  render: (args) => (
    <div className={s.row}>
      <Button {...args} shortcut="⌘S">Save</Button>
      <Button {...args} iconOnly aria-label="Add layer" shortcut="⇧⌘N"><PlusIcon /></Button>
      <Button {...args} variant="ghost" leadingIcon={<TrashIcon />} tooltip="Removes the selection from the document">
        Delete
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { stance: 'confirm', loading: true, children: 'Saving…' },
};

export const Disabled: Story = {
  render: (args) => (
    <div className={s.row}>
      <Button {...args} stance="confirm" disabled>Confirm</Button>
      <Button {...args} disabled>Solid</Button>
      <Button {...args} variant="ghost" disabled>Ghost</Button>
    </div>
  ),
};

/** A disabled button with a `disabledReason` keeps its tooltip, which says why: hover or focus one. Undo, with no
 *  reason, is natively disabled and shows nothing. */
export const DisabledWithReason: Story = {
  render: (args) => (
    <div className={s.row}>
      <Button {...args} disabled disabledReason="Nothing has changed since the last save">Save</Button>
      <Button {...args} iconOnly aria-label="Add layer" shortcut="⇧⌘N" disabled disabledReason="The document is locked">
        <PlusIcon />
      </Button>
      <Button {...args} disabled shortcut="⌘Z">Undo</Button>
    </div>
  ),
};

export const FullWidth: Story = {
  args: { stance: 'confirm', fullWidth: true, children: 'Submit' },
  render: (args) => (
    <div className={s.column}>
      <Button {...args} />
    </div>
  ),
};

const VARIANTS: ButtonVariant[] = ['solid', 'ghost'];
const SIZES: ControlSize[] = ['sm', 'md'];

export const Matrix: Story = {
  tags: ['gallery'],
  render: (args) => (
    <Sequence label="Size by variant" sweep={values(SIZES)} across={values(VARIANTS)}>
      {(sz, v) => (
        <div className={s.pair}>
          <Button {...args} variant={v} size={sz}>Button</Button>
          <Button {...args} variant={v} size={sz} disabled>Off</Button>
        </div>
      )}
    </Sequence>
  ),
};
