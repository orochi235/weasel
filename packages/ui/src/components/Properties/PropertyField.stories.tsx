import type { Meta, StoryObj } from '@weasel-js/forge';
import { type ReactNode, useState } from 'react';
import { PropertyField } from './PropertyField';
import { PropertyList } from './PropertyPanel';
import { SideBySide } from './storyLayouts';
import s from './PropertyField.stories.module.css';
import { compact, decimal, endless, unit, type Display } from '@weasel-js/quantity';
import type { Endless } from '../../endless';

const meta: Meta<typeof PropertyField> = {
  title: 'ui/Properties/PropertyField',
  component: PropertyField,
};
export default meta;
type Story = StoryObj<typeof PropertyField>;

const ALIGN = [
  { value: 'left', label: 'L' },
  { value: 'center', label: 'C' },
  { value: 'right', label: 'R' },
] as const;
type Align = (typeof ALIGN)[number]['value'];

const BLEND = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
] as const;
type Blend = (typeof BLEND)[number]['value'];

/** One of every kind, in the layout each takes by default. */
function EveryKind({ layout }: { layout?: 'block' | 'inline' }) {
  const [visible, setVisible] = useState(true);
  const [snap, setSnap] = useState(false);
  const [opacity, setOpacity] = useState(0.65);
  const [radius, setRadius] = useState(12);
  const [name, setName] = useState('Layer 1');
  const [blend, setBlend] = useState<Blend>('normal');
  const [align, setAlign] = useState<Align>('center');
  const [fill, setFill] = useState('#b08adb');
  return (
    <PropertyList pack="one-up">
      <PropertyField kind="boolean" label="Visible" value={visible} onChange={setVisible} layout={layout} />
      <PropertyField
        kind="boolean"
        control="switch"
        label="Snap"
        value={snap}
        onChange={setSnap}
        layout={layout}
      />
      <PropertyField
        kind="number"
        control="slider"
        label="Opacity"
        value={opacity}
        min={0}
        max={1}
        step={0.01}
        onChange={setOpacity}
        layout={layout}
      />
      <PropertyField kind="number" label="Radius" value={radius} unit="px" onChange={setRadius} layout={layout} />
      <PropertyField kind="string" label="Name" value={name} onChange={setName} layout={layout} />
      <PropertyField kind="enum" label="Blend" value={blend} options={BLEND} onChange={setBlend} layout={layout} />
      <PropertyField
        kind="enum"
        control="toggle"
        label="Align"
        value={align}
        options={ALIGN}
        onChange={setAlign}
        layout={layout}
      />
      <PropertyField kind="color" label="Fill" value={fill} onChange={setFill} layout={layout} />
    </PropertyList>
  );
}

export const BothLayouts: Story = {
  render: () => <SideBySide block={<EveryKind />} inline={<EveryKind layout="inline" />} />,
};

function Slider({ initial, ...rest }: {
  initial: number;
  label: string;
  min: number;
  max: number;
  step?: number;
  display?: Display;
  unit?: ReactNode;
  endless?: Endless;
}) {
  const [value, setValue] = useState(initial);
  return <PropertyField kind="number" control="slider" value={value} onChange={setValue} {...rest} />;
}

/** A slider's readout is editable, carries a unit, widens to the widest value
 *  its range can show, and abbreviates under `compact`. */
export const SliderReadouts: Story = {
  render: () => (
    <div className={s.column}>
      <Slider initial={12} label="Radius" min={0} max={64} unit="px" />
      <Slider initial={45} label="Angle" min={-180} max={180} unit={<sup>°</sup>} />
      <Slider initial={200_000} label="Glyphs" min={0} max={200_000} step={1000} />
      <Slider initial={2_000_000} label="Glyphs" min={0} max={2_000_000} step={1000} display={compact()} />
    </div>
  ),
};

/** An end that stands for infinity: drag to the top and the value is
 *  `Infinity`, read as the display's word with no unit beside it — or `∞`
 *  when the display names none. Type the word, or `∞`, to set it. */
export const EndlessEnd: Story = {
  render: () => (
    <div className={s.column}>
      <Slider initial={Infinity} label="Cut at" min={0} max={5000} step={50} unit="ms" endless="max" display={endless(decimal({ grouping: false }), 'never')} />
      <Slider initial={1200} label="Mute at" min={0} max={8000} step={100} unit="ms" endless="max" display={endless(decimal({ grouping: false }), 'never')} />
      <Slider initial={Infinity} label="Cap step" min={16} max={64} step={8} endless="max" display={endless(unit('ms'), 'uncapped')} />
      <Slider initial={-Infinity} label="Floor" min={0} max={100} endless="min" />
    </div>
  ),
};

/** `onInput` follows the drag and `onChange` fires once it ends. Drag the
 *  track, or type into the number, and watch the two counts diverge. */
export const LiveAndCommitted: Story = {
  render: () => {
    function Split() {
      const [value, setValue] = useState(40);
      const [text, setText] = useState('draft');
      const [moves, setMoves] = useState(0);
      const [commits, setCommits] = useState(0);
      const live = () => setMoves((c) => c + 1);
      const settled = () => setCommits((c) => c + 1);
      return (
        <div className={s.column}>
          <PropertyField
            kind="number"
            control="slider"
            label="Samples"
            value={value}
            min={0}
            max={100}
            onInput={(n) => {
              setValue(n);
              live();
            }}
            onChange={settled}
          />
          <PropertyField
            kind="string"
            label="Title"
            value={text}
            onInput={live}
            onChange={(next) => {
              setText(next);
              settled();
            }}
          />
          <p className={s.count}>
            {moves} live, {commits} committed
          </p>
        </div>
      );
    }
    return <Split />;
  },
};

/** `alpha` as a number is a channel of its own; `true` keeps it in the hex. */
export const ColorAlpha: Story = {
  render: () => {
    function Alphas() {
      const [fill, setFill] = useState('#7ec8e3');
      const [fillAlpha, setFillAlpha] = useState(0.65);
      const [tint, setTint] = useState('#b08adb80');
      return (
        <div className={s.wide}>
          <PropertyList>
            <PropertyField
              kind="color"
              label="Fill"
              value={fill}
              onChange={setFill}
              alpha={fillAlpha}
              onAlphaChange={setFillAlpha}
            />
            <PropertyField kind="color" label="Tint" value={tint} alpha onChange={setTint} />
          </PropertyList>
          <PropertyField
            kind="color"
            label="Flat"
            value={fill}
            onChange={setFill}
            alpha={1}
            alphaDisabled
          />
        </div>
      );
    }
    return <Alphas />;
  },
};

/** What a field shows when its sources disagree, and when they agree on
 *  holding nothing: no value chosen, in whatever form each control has. */
export const MixedAndUnset: Story = {
  render: () => {
    const ignore = () => {};
    const column = (state: { mixed?: boolean; unset?: boolean }) => (
      <PropertyList pack="one-up">
        <PropertyField kind="boolean" label="Visible" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="boolean" control="switch" label="Snap" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="number" label="Radius" value={undefined} onChange={ignore} {...state} />
        <PropertyField
          kind="number"
          control="slider"
          label="Opacity"
          value={undefined}
          min={0}
          max={1}
          step={0.01}
          onChange={ignore}
          {...state}
        />
        <PropertyField kind="string" label="Name" value={undefined} onChange={ignore} {...state} />
        <PropertyField kind="enum" label="Blend" value={undefined} options={BLEND} onChange={ignore} {...state} />
        <PropertyField kind="color" label="Fill" value={undefined} onChange={ignore} {...state} />
      </PropertyList>
    );
    return (
      <div className={s.pair}>
        <div>
          <p className={s.caption}>Mixed</p>
          {column({ mixed: true })}
        </div>
        <div>
          <p className={s.caption}>Unset</p>
          {column({ unset: true })}
        </div>
      </div>
    );
  },
};

/** A number reading a unit typed into it (`15mm` here), a choice drawn as
 *  segments and as a radio list, and a color with its opacity track. */
export const UnitsChoicesAlpha: Story = {
  render: () => {
    function Kinds() {
      const [on, setOn] = useState(true);
      const [width, setWidth] = useState(2.5);
      const [label, setLabel] = useState('Title');
      const [blend, setBlend] = useState<Blend>('multiply');
      const [align, setAlign] = useState<Align>('left');
      const [fill, setFill] = useState('#ffb347cc');
      return (
        <div className={s.column}>
          <PropertyList pack="one-up">
            <PropertyField kind="boolean" label="Visible" value={on} onChange={setOn} layout="inline" />
            <PropertyField
              kind="number"
              label="Width"
              value={width}
              unit="cm"
              accepts={{ cm: 1, mm: 0.1, in: 2.54 }}
              onChange={setWidth}
              layout="inline"
            />
            <PropertyField kind="string" label="Label" value={label} onChange={setLabel} layout="inline" />
            <PropertyField kind="enum" label="Blend" value={blend} options={BLEND} onChange={setBlend} layout="inline" />
            <PropertyField kind="enum" control="toggle" label="Align" value={align} options={ALIGN} onChange={setAlign} />
            <PropertyField kind="enum" control="radio" label="Align, listed" value={align} options={ALIGN} onChange={setAlign} />
            <PropertyField kind="color" label="Fill" value={fill} alpha onChange={setFill} />
          </PropertyList>
        </div>
      );
    }
    return <Kinds />;
  },
};

/** An auto row hides its control and reads out the word; its label toggles
 *  the state. */
export const Auto: Story = {
  render: () => {
    function AutoRows() {
      const [auto, setAuto] = useState(true);
      const [gap, setGap] = useState(12);
      return (
        <div className={s.column}>
          <PropertyField
            kind="number"
            control="slider"
            label="Gap"
            value={gap}
            min={0}
            max={48}
            onChange={setGap}
            auto={auto}
            onAutoChange={setAuto}
            readout={auto ? 'auto' : undefined}
          />
        </div>
      );
    }
    return <AutoRows />;
  },
};
