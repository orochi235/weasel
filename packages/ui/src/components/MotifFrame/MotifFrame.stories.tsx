import type { Meta, StoryObj } from '@weasel-js/forge';
import { Button } from '../Button';
import { PropertyField, PropertyGroup, PropertyList } from '../Properties';
import { MotifFrame } from './MotifFrame';
import { notch, plaque, rule, stereo, tab } from './motifs';
import s from './MotifFrame.stories.module.css';

const meta: Meta<typeof MotifFrame> = {
  title: 'ui/MotifFrame',
  component: MotifFrame,
};
export default meta;

type Story = StoryObj<typeof MotifFrame>;

function Jacks({ names }: { names: readonly string[] }) {
  return (
    <div className={s.jacks}>
      {names.map((name) => (
        <span key={name} className={s.jack}>
          {name}
        </span>
      ))}
    </div>
  );
}

const VIDEO = ['Y', 'PB', 'PR'];

export const Motifs: Story = {
  render: () => (
    <div className={s.wall}>
      <MotifFrame title="Rule" motif={rule()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Component" motif={stereo()} tone={0}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Notch" motif={notch()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Tab" motif={tab()} tone={2}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Plaque" motif={plaque()} tone={4}>
        <Jacks names={VIDEO} />
      </MotifFrame>
    </div>
  ),
};

export const StereoSides: Story = {
  render: () => (
    <div className={s.wall}>
      {(['left', 'right', 'top', 'bottom'] as const).map((side, i) => (
        <MotifFrame key={side} title={`Audio ${side}`} motif={stereo({ side })} tone={i}>
          <Jacks names={['L', 'R']} />
        </MotifFrame>
      ))}
      {(['start', 'center', 'end'] as const).map((labelAlign) => (
        <MotifFrame key={labelAlign} title={labelAlign} motif={stereo({ labelAlign })} tone={5}>
          <Jacks names={['L', 'R', 'SUB']} />
          <Jacks names={['L', 'R', 'SUB']} />
        </MotifFrame>
      ))}
    </div>
  ),
};

export const HeadingParts: Story = {
  render: () => (
    <div className={s.wall}>
      {[rule(), stereo({ side: 'top' }), notch(), tab(), plaque()].map((motif, i) => (
        <MotifFrame
          key={motif.id}
          title={motif.id}
          motif={motif}
          tone={i}
          actions={
            <Button variant="ghost" size="sm">
              clear
            </Button>
          }
        >
          <Jacks names={VIDEO} />
        </MotifFrame>
      ))}
    </div>
  ),
};

export const PlaqueMix: Story = {
  render: () => (
    <div className={s.wall}>
      {[100, 60, 30].map((mix) => (
        <MotifFrame key={mix} title={`${mix}%`} motif={plaque({ mix })} tone={1}>
          <Jacks names={VIDEO} />
        </MotifFrame>
      ))}
    </div>
  ),
};

/** `PropertyGroup` takes a motif the same way: folding, packing and rows are its own. */
export const AsPropertyGroups: Story = {
  render: () => (
    <div className={s.narrow}>
      <PropertyList>
        <PropertyGroup title="Bevel" collapsible tone={0}>
          <PropertyField kind="number" label="Depth" value={4} onChange={() => {}} layout="inline" />
        </PropertyGroup>
        <PropertyGroup title="Dome" motif={stereo()} tone={1}>
          <PropertyField kind="number" label="Height" value={12} onChange={() => {}} layout="inline" />
        </PropertyGroup>
        <PropertyGroup title="Aqua" motif={notch()} collapsible>
          <PropertyField kind="boolean" label="Gloss" value onChange={() => {}} />
        </PropertyGroup>
        <PropertyGroup title="Shadow" motif={plaque()} tone={3}>
          <PropertyField kind="number" label="Blur" value={6} onChange={() => {}} layout="inline" />
        </PropertyGroup>
      </PropertyList>
    </div>
  ),
};
