import type { Meta, StoryObj } from '@weasel-js/forge';
import { Badge, BADGE_EMPHASIS_ICONS, BADGE_GRADE_ICONS, BADGE_VARIANT_ICONS } from '@weasel-js/ui/components/Badge';
import { EMPHASES, GRADES } from '@weasel-js/theme';
import st from './Badge.stories.module.css';
import { ALL_SHAPES } from './shapes';
import { BADGE_LOOKS, lookOf, lookProps } from './looks';
import type { BadgeVariant } from './types';
import { ComposeLabView } from './lab/ComposeLabView';
import { QuatrefoilOctantSweeps } from './lab/QuatrefoilOctants';
import { ShapeGallery } from './lab/ShapeGallery';

const VARIANTS: BadgeVariant[] = ['outline', 'solid', 'subtle'];

const meta: Meta<typeof Badge> = {
  title: 'ui/Foundations/Badge',
  component: Badge,
  args: {
    children: 'LABEL',
    shape: 'pill',
    emphasis: 'high',
    variant: 'outline',
    size: 'sm',
  },
  argTypes: {
    children: { control: 'text', description: 'Badge label content' },
    shape: { control: 'select', options: ALL_SHAPES },
    grade: { control: { type: 'inline-radio', icons: BADGE_GRADE_ICONS }, options: [undefined, ...GRADES] },
    emphasis: { control: { type: 'inline-radio', icons: BADGE_EMPHASIS_ICONS }, options: [undefined, ...EMPHASES] },
    variant: { control: { type: 'inline-radio', icons: BADGE_VARIANT_ICONS }, options: VARIANTS },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md'] },
    bloat: {
      control: { type: 'range', min: -10, max: 20, step: 0.25 },
      description: 'Edge bloat: offsets every base perimeter sample outward by N CSS px before compose effects. Negative shrinks. Compose mode only.',
    },
    padding: {
      control: 'text',
      description: 'Optional CSS padding override (any CSS padding string). If set, overrides the TRBL sliders.',
    },
    crawl: {
      control: { type: 'range', min: 0, max: 2, step: 0.05 },
      description: 'Continuously shifts perimeter-pattern shapes (beavis, cloud). 0 = off; value = cycles per second.',
    },
    shapeParams: {
      control: 'object',
      description: "Shape-specific params, e.g. { erosion: 0.5 } for square/notched, { left: 'outward', right: 'inward' } for ribbon.",
    },
    onClick: { table: { disable: true } },
    onRemove: { table: { disable: true } },
    removeLabel: { table: { disable: true } },
    href: { table: { disable: true } },
    as: { table: { disable: true } },
    className: { table: { disable: true } },
    'aria-label': { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllShapes: Story = {
  tags: ['gallery'],
  args: {
    children: 'ZORF',
    emphasis: 'low',
    variant: 'outline',
  },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
  },
  render: (args) => (
    <ShapeGallery
      look={lookOf(args)}
      variant={args.variant ?? 'outline'}
      label={typeof args.children === 'string' ? args.children : 'LABEL'}
    />
  ),
};

export const LookVariantMatrix: Story = {
  tags: ['gallery'],
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
      <table className={st.matrix}>
        <thead>
          <tr>
            <th></th>
            {VARIANTS.map((v) => <th key={v} className={st.matrixHead}>{v}</th>)}
          </tr>
        </thead>
        <tbody>
          {BADGE_LOOKS.map((look) => (
            <tr key={look}>
              <td className={st.matrixHead}>{look}</td>
              {VARIANTS.map((variant) => (
                <td key={variant}>
                  <Badge
                    shape={args.shape as never}
                    {...lookProps(look)}
                    variant={variant}
                    size={args.size}
                                     >
                    {label}
                  </Badge>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
};

/** `tint` says which of its peers a badge is: an index into the theme's tint
 *  list, the same one a panel takes. It paints over grade and emphasis. */
export const PeerTones: Story = {
  render: (args) => (
    <div>
      {VARIANTS.map((variant) => (
        <p key={variant}>
          {[0, 1, 2, 3, 4, 5].map((tint) => (
            <span key={tint}>
              <Badge shape={args.shape as never} variant={variant} size={args.size} tint={tint}>
                {`peer ${tint}`}
              </Badge>{' '}
            </span>
          ))}
        </p>
      ))}
    </div>
  ),
};

export const BaselineRow: Story = {
  name: 'Baseline justification',
  render: (_args) => (
    <p className={st.baselineText}>
      Inline text with{' '}
      <Badge shape="pill" emphasis="high" >pill</Badge>{' '}
      <Badge shape="square" grade="info" >square</Badge>{' '}
      <Badge shape="notched" grade="warn" >notched</Badge>{' '}
      <Badge shape="shield" grade="danger" >shield</Badge>{' '}
      <Badge shape="ribbon" emphasis="low" shapeParams={{ left: 'outward', right: 'outward' } as never} >ribbon</Badge>{' '}
      <Badge shape="house" emphasis="high" >house</Badge>{' '}
      and trailing copy.
    </p>
  ),
};

export const Sizes: Story = {
  render: (args) => {
    const label = typeof args.children === 'string' ? args.children : 'LABEL';
    return (
      <div className={st.row}>
        <Badge size="xs" shape={args.shape as never} grade={args.grade} emphasis={args.emphasis} variant={args.variant}>{label} xs</Badge>
        <Badge size="sm" shape={args.shape as never} grade={args.grade} emphasis={args.emphasis} variant={args.variant}>{label} sm</Badge>
        <Badge size="md" shape={args.shape as never} grade={args.grade} emphasis={args.emphasis} variant={args.variant}>{label} md</Badge>
      </div>
    );
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

/** With both, the root stays a `<span>`: the label is the click target and the remove button sits beside it. */
export const ClickableRemovable: Story = {
  name: 'Clickable and removable',
  args: { onClick: () => {}, onRemove: () => {} },
};

export const LinkRemovable: Story = {
  name: 'Link and removable',
  args: { href: '#badge', onRemove: () => {} },
};

/** A plain badge with `tooltip` joins the tab order as an image named by its
 *  text; hover or Tab to it. */
export const WithTooltip: Story = {
  args: { children: '?', emphasis: 'low', size: 'xs', tooltip: 'Matched by a predicate, not a fixed id' },
};

export const EdgeCases: Story = {
  render: (_args) => (
    <div className={`${st.row} ${st.wrappingRow}`}>
      <Badge grade="info" >A very long label that tests overflow</Badge>
      <Badge shape="plain" grade="warn" >
        <span className={st.dot} />
        live
      </Badge>
      <Badge shape="starburst" grade="danger" variant="solid" >NEW</Badge>
      <Badge shape="ribbon" emphasis="high" shapeParams={{ left: 'outward', right: 'outward' } as never} >RIBBON</Badge>
      <Badge shape="perforated" emphasis="low" >STAMP</Badge>
      <Badge shape="house" grade="info" >HOME</Badge>
      <Badge shape="cloud" grade="warn" >CLOUDY</Badge>
    </div>
  ),
};

export const InlineWrapping: Story = {
  name: 'Edge case: inline wrap mid-badge',
  render: (_args) => (
    <div className={st.narrowColumn}>
      <p>
        A normal paragraph that contains{' '}
        <Badge shape="pill" emphasis="high" >
          a sufficiently long inline badge label
        </Badge>{' '}
        and continues afterward to force the badge to be broken across two visual lines.
      </p>
      <p>
        With <code>display: inline-flex</code>, badges don't fragment — they stay whole and either fit the line or push to a new one.
        Here's the same thing with a longer payload:{' '}
        <Badge shape="square" grade="info" >
          this badge has even more text inside that the line can't hold
        </Badge>{' '}
        trailing copy.
      </p>
      <p>
        Constrained-width container —{' '}
        <Badge shape="ribbon" grade="warn" >
          a ribbon badge that wraps because of width
        </Badge>{' '}
        and we keep going.
      </p>
    </div>
  ),
};

/** Drag the box's corner: the remove control keeps to the line of the label's last word. */
export const RemovableWrapping: Story = {
  name: 'Edge case: removable, wrapped',
  render: (_args) => (
    <div className={st.resizable}>
      <p>
        xx <Badge emphasis="high" onRemove={() => {}}>alpha beta gamma</Badge> yy
      </p>
      <p>
        xx <Badge shape="plain" grade="info" onClick={() => {}} onRemove={() => {}}>alpha beta gamma</Badge> yy
      </p>
      <div className={st.row}>
        <Badge emphasis="high" onRemove={() => {}}>two words</Badge>
        <Badge shape="plain" grade="info" onRemove={() => {}}>two words</Badge>
        <span>after</span>
      </div>
    </div>
  ),
};

export const ComposeShowcase: Story = {
  tags: ['gallery'],
  name: 'Compose: base + effects',
  args: { children: 'COMPOSE', grade: 'danger', variant: 'solid' },
  render: (args) => (
    <div className={st.showcase}>
      <Badge
        {...args}
        base="chamfered-rect"
        baseParams={{ chamfer: 8 }}
        effects={[{ type: 'spikes', params: { count: 48, length: 10, baseWidth: 3, vertScale: 1.4, diagonalScale: 0.55 } }]}
      >
        SPIKES
      </Badge>
      <Badge
        {...args}
        emphasis="high"
        variant="outline"
        base="chamfered-rect"
        baseParams={{ chamfer: 12 }}
        effects={[{ type: 'spikes', params: { count: 60, length: 14, baseWidth: 2.5, vertScale: 1.8, irregularity: 0.3 } }]}
      >
        URCHIN
      </Badge>
      <Badge
        {...args}
        grade="info"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.5 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 16, puffiness: 10 } }]}
      >
        CLOUD
      </Badge>
      <Badge
        {...args}
        grade="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.75 }}
        effects={[{ type: 'puffs', params: { bumpWidth: 14, puffiness: 8, irregularity: 0.6 } }]}
      >
        BUMPY
      </Badge>
      <Badge
        {...args}
        emphasis="low"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.27 }}
        effects={[{ type: 'bites', params: { biteRadius: 3, biteSpacing: 8 } }]}
      >
        STAMP
      </Badge>
      <Badge
        {...args}
        grade="info"
        variant="solid"
        base="chamfered-rect"
        baseParams={{ chamfer: 6 }}
        effects={[
          { type: 'bites', params: { biteRadius: 2.5, biteSpacing: 7 } },
          { type: 'spikes', params: { count: 18, length: 6, baseWidth: 2, diagonalScale: 0.4 } },
        ]}
      >
        DUAL
      </Badge>
      <Badge
        {...args}
        emphasis="high"
        variant="outline"
        base="rounded-rect"
        baseParams={{ erosion: 0.4 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 5, scallopSpacing: 12 } }]}
      >
        SCALLOPS
      </Badge>
      <Badge
        {...args}
        emphasis="low"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.67 }}
        effects={[{ type: 'scallops', params: { scallopRadius: 3, scallopSpacing: 7, irregularity: 0.5 } }]}
      >
        WAVY
      </Badge>
      <Badge
        {...args}
        grade="warn"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0 }}
        effects={[
          { type: 'bevel', params: { bevelWidth: 6, lightFrom: 'tl' } },
          { type: 'sheen', params: { lightFrom: 'tl', intensity: 0.22 } },
          { type: 'rivets', params: { radius: 2.4, inset: 7, lightFrom: 'tl' } },
        ]}
      >
        PLAQUE
      </Badge>
      <Badge
        {...args}
        grade="info"
        variant="solid"
        base="rounded-rect"
        baseParams={{ erosion: 0.4 }}
        effects={[
          { type: 'scallops', params: { scallopRadius: 4, scallopSpacing: 9 } },
          { type: 'bevel', params: { bevelWidth: 4, lightFrom: 'br' } },
          { type: 'sheen', params: { lightFrom: 'br', intensity: 0.18 } },
        ]}
      >
        STACKED
      </Badge>
    </div>
  ),
};

export const SlotPillReplica: Story = {
  name: 'Slot pill (migration parity)',
  render: (_args) => (
    <div className={`${st.row} ${st.tightRow}`}>
      <Badge shape="pill" emphasis="high" variant="outline" >active</Badge>
      <Badge shape="pill" grade="warn" variant="outline" >ambient</Badge>
      <Badge shape="pill" grade="info" variant="outline" >hotkey</Badge>
      <Badge shape="pill" grade="danger" variant="solid" >inactive</Badge>
    </div>
  ),
};

export const QuatrefoilOctants: Story = {
  name: 'Quatrefoil octants',
  args: { children: 'OCTANT' },
  argTypes: {
    shape: { table: { disable: true } }, shapeParams: { table: { disable: true } },
    base: { table: { disable: true } }, baseParams: { table: { disable: true } },
    effects: { table: { disable: true } }, grade: { table: { disable: true } }, emphasis: { table: { disable: true } },
    variant: { table: { disable: true } }, size: { table: { disable: true } },
    crawl: { table: { disable: true } }, bloat: { table: { disable: true } },
    padding: { table: { disable: true } },
  },
  render: () => <QuatrefoilOctantSweeps />,
};

export const ComposeLab: Story = {
  name: 'Compose lab',
  args: { children: 'COMPOSE', emphasis: 'high', variant: 'solid' },
  argTypes: {
    shape: { table: { disable: true } },
    shapeParams: { table: { disable: true } },
    base: { table: { disable: true } },
    baseParams: { table: { disable: true } },
    effects: { table: { disable: true } },
  },
  render: (args) => (
    <ComposeLabView
      look={lookOf(args)}
      variant={args.variant ?? 'solid'}
      label={typeof args.children === 'string' ? args.children : 'COMPOSE'}
    />
  ),
};
