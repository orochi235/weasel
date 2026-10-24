import type { Meta, StoryObj } from '@weasel-js/forge';
import { Button } from '@weasel-js/ui/components/Button';
import { PropertyField, PropertyGroup, PropertyList } from '@weasel-js/ui/components/Properties';
import { MotifFrame, notch, plaque, rule, stereo, tab, titlebar } from '@weasel-js/ui/components/MotifFrame';
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
      <MotifFrame title="Component" motif={stereo()} tint={0}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Notch" motif={notch()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Tab" motif={tab()} tint={2}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Plaque" motif={plaque()} tint={4}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame title="Titlebar" motif={titlebar()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
    </div>
  ),
};

export const StereoSides: Story = {
  render: () => (
    <div className={s.wall}>
      {(['left', 'right', 'top', 'bottom'] as const).map((side, i) => (
        <MotifFrame key={side} title={`Audio ${side}`} motif={stereo({ side })} tint={i}>
          <Jacks names={['L', 'R']} />
        </MotifFrame>
      ))}
      {(['start', 'center', 'end'] as const).map((labelAlign) => (
        <MotifFrame key={labelAlign} title={labelAlign} motif={stereo({ labelAlign })} tint={5}>
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
      {[rule(), stereo({ side: 'top' }), notch(), tab(), plaque(), titlebar()].map((motif, i) => (
        <MotifFrame
          key={motif.id}
          title={motif.id}
          motif={motif}
          tint={i}
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
        <MotifFrame key={mix} title={`${mix}%`} motif={plaque({ mix })} tint={1}>
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
        <PropertyGroup title="Bevel" collapsible tint={0}>
          <PropertyField kind="number" label="Depth" value={4} onChange={() => {}} layout="inline" />
        </PropertyGroup>
        <PropertyGroup title="Dome" motif={stereo()} tint={1}>
          <PropertyField kind="number" label="Height" value={12} onChange={() => {}} layout="inline" />
        </PropertyGroup>
        <PropertyGroup title="Aqua" motif={notch()} collapsible>
          <PropertyField kind="boolean" label="Gloss" value onChange={() => {}} />
        </PropertyGroup>
        <PropertyGroup title="Shadow" motif={plaque()} tint={3}>
          <PropertyField kind="number" label="Blur" value={6} onChange={() => {}} layout="inline" />
        </PropertyGroup>
      </PropertyList>
    </div>
  ),
};
