import type { Meta, StoryObj } from '@weasel-js/forge';
import { Button } from '@weasel-js/ui/components/Button';
import { PropertyField, PropertyGroup, PropertyList, PropertyPanel, Subpanel } from '@weasel-js/ui/components/Properties';
import type { ReactNode } from 'react';
import { DefaultMotif, type Motif, MotifFrame, type MotifFrameProps, notch, plaque, rule, stereo, tab, titlebar } from '@weasel-js/ui/components/MotifFrame';
import { Sequence, values } from '@weasel-js/ui/components/Sequence';
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
  render: (args) => (
    <div className={s.wall}>
      <MotifFrame {...args} title="Rule" motif={rule()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame {...args} title="Component" motif={stereo()} tint={0}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame {...args} title="Notch" motif={notch()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame {...args} title="Tab" motif={tab()} tint={2}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame {...args} title="Plaque" motif={plaque()} tint={4}>
        <Jacks names={VIDEO} />
      </MotifFrame>
      <MotifFrame {...args} title="Titlebar" motif={titlebar()}>
        <Jacks names={VIDEO} />
      </MotifFrame>
    </div>
  ),
};

interface Frame {
  title: string;
  motif: Motif;
  tint: number;
  jacks: readonly (readonly string[])[];
}

function Wall({ label, frames, args, actions }: { label: string; frames: Frame[]; args: Partial<MotifFrameProps>; actions?: ReactNode }) {
  return (
    <Sequence label={label} sweep={values(frames, (f) => f.title)} caption={false} className={s.frames}>
      {(f) => (
        <MotifFrame {...args} title={f.title} motif={f.motif} tint={f.tint} actions={actions}>
          {f.jacks.map((names, i) => <Jacks key={i} names={names} />)}
        </MotifFrame>
      )}
    </Sequence>
  );
}

const STEREO_SIDES: Frame[] = [
  ...(['left', 'right', 'top', 'bottom'] as const).map((side, i) => ({
    title: `Audio ${side}`, motif: stereo({ side }), tint: i, jacks: [['L', 'R']],
  })),
  ...(['start', 'center', 'end'] as const).map((labelAlign) => ({
    title: labelAlign, motif: stereo({ labelAlign }), tint: 5, jacks: [['L', 'R', 'SUB'], ['L', 'R', 'SUB']],
  })),
];

export const StereoSides: Story = {
  render: (args) => <Wall label="Stereo sides" frames={STEREO_SIDES} args={args} />,
};

const HEADING_PARTS: Frame[] = [rule(), stereo({ side: 'top' }), notch(), tab(), plaque(), titlebar()].map((motif, i) => ({
  title: motif.id, motif, tint: i, jacks: [VIDEO],
}));

export const HeadingParts: Story = {
  render: (args) => (
    <Wall label="Heading parts" frames={HEADING_PARTS} args={args} actions={<Button variant="ghost" size="sm">clear</Button>} />
  ),
};

const PLAQUE_MIX: Frame[] = [100, 60, 30].map((mix) => ({ title: `${mix}%`, motif: plaque({ mix }), tint: 1, jacks: [VIDEO] }));

export const PlaqueMix: Story = {
  render: (args) => <Wall label="Plaque mix" frames={PLAQUE_MIX} args={args} />,
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

/**
 * Every kind of frame — a panel, its groups, a subpanel — takes a motif, and `DefaultMotif`
 * names one per kind. The kind keeps its own colors and title type in any motif: the panel's
 * title bar is the panel's, not a group's.
 */
export const EveryKind: Story = {
  render: () => (
    <div className={s.narrow}>
      <DefaultMotif panel={titlebar()} group={stereo({ side: 'top' })}>
        <PropertyPanel title="Window" collapsible>
          <PropertyList>
            <PropertyField kind="number" label="Opacity" value={80} onChange={() => {}} layout="inline" />
            <PropertyGroup title="Bevel" tint={1}>
              <PropertyField kind="number" label="Depth" value={4} onChange={() => {}} layout="inline" />
            </PropertyGroup>
            <Subpanel title="Glow">
              <PropertyField kind="number" label="Blur" value={6} onChange={() => {}} layout="inline" />
            </Subpanel>
          </PropertyList>
        </PropertyPanel>
      </DefaultMotif>
    </div>
  ),
};
